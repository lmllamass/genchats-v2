/**
 * operadores.js — alta/baja de operadoras sobre un proyecto (bandeja compartida).
 *
 * Distinto de /api/admin/invitar: aquello da de alta un CLIENTE nuevo de la plataforma
 * (con su propio plan). Esto vincula a una persona a UN proyecto ya existente, sin plan
 * ni facturación propia — solo acceso operativo (conversaciones, leads, notas).
 */

import express from 'express';
import { Resend } from 'resend';
import { supabase } from '../server.js';
import { projectForUser, canManageOperators, accessibleProjects, isOperatorOnly } from '../lib/projectAccess.js';

const router = express.Router();

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

// GET /api/operadores/mis-proyectos — propios + aquellos donde soy operadora (para el
// Dashboard). Distinto de Proyecto.list (solo propios), que sigue usándose para contar
// contra el límite del plan — una operadora no "posee" los proyectos que atiende.
router.get('/mis-proyectos', async (req, res) => {
  try {
    const { all, owned } = await accessibleProjects(req.user.id, '*');
    const soloOperadora = await isOperatorOnly(req.user.id);
    res.json({ proyectos: all, soy_solo_operadora: soloOperadora, tiene_propios: owned.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/operadores?proyecto_id=X
router.get('/', async (req, res) => {
  try {
    const { proyecto_id } = req.query;
    const proyecto = await projectForUser(proyecto_id, req.user.id);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const { data, error } = await supabase
      .from('proyecto_operadores')
      .select('id, user_id, rol, email, nombre, activo, created_at')
      .eq('proyecto_id', proyecto_id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    res.json({ operadores: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/operadores  body: { proyecto_id, email, nombre, rol }
router.post('/', async (req, res) => {
  try {
    const { proyecto_id, email, nombre, rol, confirmar_cliente_existente } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: 'email requerido' });
    const rolFinal = rol === 'supervisor' ? 'supervisor' : 'operador';

    const puedeGestionar = await canManageOperators(proyecto_id, req.user.id);
    if (!puedeGestionar) return res.status(403).json({ error: 'Solo el dueño o una supervisora pueden invitar operadoras' });

    const { data: proyecto } = await supabase.from('proyectos').select('id, nombre').eq('id', proyecto_id).single();
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const emailNorm = email.trim().toLowerCase();

    // ¿Ya existe una cuenta con ese email?
    //
    // Se busca en user_profiles Y, si no aparece, en auth: el trigger handle_new_user y el
    // loadProfile del frontend crean el perfil SIN email (solo id/full_name/plan), así que
    // hay perfiles con email=null que una búsqueda por email nunca encontraría. Sin este
    // segundo intento, invitar a alguien que ya tiene cuenta tomaría el camino de "cuenta
    // nueva" y el aviso de "ya es cliente" no saltaría nunca.
    let { data: existingProfile } = await supabase
      .from('user_profiles').select('id, tipo_cuenta, plan').ilike('email', emailNorm).maybeSingle()
      .then(r => r, () => ({ data: null }));

    if (!existingProfile) {
      const { data: authList } = await supabase.auth.admin
        .listUsers({ perPage: 1000 }).then(r => r, () => ({ data: null }));
      const authUser = (authList?.users || []).find(u => (u.email || '').toLowerCase() === emailNorm);
      if (authUser) {
        const { data: perfil } = await supabase
          .from('user_profiles').select('id, tipo_cuenta, plan').eq('id', authUser.id).maybeSingle()
          .then(r => r, () => ({ data: null }));
        // Si existe en auth pero sin perfil, se trata como cuenta existente igualmente:
        // el upsert de más abajo completará el perfil que falta.
        existingProfile = perfil || { id: authUser.id, tipo_cuenta: null, plan: null };
      }
    }

    let userId = existingProfile?.id;
    let esNueva = false;

    // Si ese email ya es un CLIENTE, avisar antes de mezclar los dos papeles (dueño de lo
    // suyo + operadora de lo ajeno). Se puede forzar, pero no en silencio: es justo la
    // confusión que hay que evitar.
    //
    // Se comprueban DOS señales, no solo los proyectos propios: aquí los proyectos suelen
    // crearse bajo la cuenta de administración, así que un cliente que paga puede tener 0
    // proyectos a su nombre y aun así ser un cliente de pleno derecho.
    if (userId && !confirmar_cliente_existente) {
      const { count: propios } = await supabase
        .from('proyectos').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      const planDePago = existingProfile.plan && !['free', 'gratis'].includes(existingProfile.plan);

      if (propios > 0 || planDePago) {
        const motivo = planDePago
          ? `ya es un cliente con plan ${existingProfile.plan}`
          : `ya tiene ${propios} chatbot(s) propios`;
        return res.status(409).json({
          error: 'cliente_existente',
          mensaje: `${emailNorm} ${motivo}. Si continúas, esa persona conservará su cuenta de cliente y además podrá atender este proyecto.`,
          requiere_confirmacion: true,
        });
      }
    }

    // ¿Hace falta mandarle un enlace para poner contraseña? Sí si la cuenta no existe, y
    // también si existe pero nunca ha iniciado sesión (p. ej. una invitación anterior que se
    // cortó a medias): en ese caso tiene usuario en auth pero no puede entrar.
    let necesitaEnlace = !userId;
    if (userId) {
      const { data: authUser } = await supabase.auth.admin
        .getUserById(userId).then(r => r, () => ({ data: null }));
      necesitaEnlace = !authUser?.user?.last_sign_in_at;
    }

    if (necesitaEnlace) {
      const siteUrl = process.env.APP_URL || 'https://v2.genchats.app';
      // 'invite' si es nueva; 'recovery' si ya existe en auth ('invite' daría email_exists).
      let { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: userId ? 'recovery' : 'invite',
        email: emailNorm,
        options: { redirectTo: `${siteUrl}/reset-password` },
      });
      if (linkError && (linkError.code === 'email_exists' || linkError.status === 422)) {
        ({ data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: emailNorm,
          options: { redirectTo: `${siteUrl}/reset-password` },
        }));
      }
      if (linkError) return res.status(400).json({ error: linkError.message });

      userId = userId || linkData?.user?.id;
      if (!userId) return res.status(500).json({ error: 'No se pudo crear la cuenta de la operadora' });
      esNueva = true;

      const inviteUrl = linkData?.properties?.action_link || linkData?.action_link;
      const resend = getResend();
      if (resend && inviteUrl) {
        await resend.emails.send({
          from: `GenChat IA <${process.env.RESEND_FROM_EMAIL || 'noreply@genchats.app'}>`,
          to: emailNorm,
          subject: `Te han invitado a atender ${proyecto.nombre} en GenChat IA`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">
              <h2 style="color:#7c3aed">Te han invitado como operadora</h2>
              <p>Vas a poder atender las conversaciones de <strong>${proyecto.nombre}</strong> desde GenChat IA.</p>
              <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
                Crear mi contraseña y entrar
              </a>
              <p style="color:#6b7280;font-size:14px">Si no esperabas esta invitación, puedes ignorar este email.</p>
            </div>
          `,
        }).catch(() => {});
      }
    }

    // Completa/crea el perfil. Solo se marca tipo_cuenta='operadora' si NO tiene plan de
    // pago: un cliente que además atiende proyectos ajenos sigue siendo cliente (ver la
    // migración 019 y su trigger, que refuerzan esto en la propia BD).
    const planActual = existingProfile?.plan;
    const esClienteDePago = planActual && !['free', 'gratis'].includes(planActual);
    // `.then(null, ...)` y no `.catch(...)`: el query builder de Supabase es un thenable,
    // no una Promise — no tiene .catch() y llamarlo lanza un TypeError.
    // El nombre solo se escribe si se ha indicado uno, o si el perfil aún no existía: no hay
    // que pisar el nombre real de alguien que ya tenía cuenta.
    const perfilNuevo = !existingProfile;
    await supabase.from('user_profiles').upsert({
      id: userId,
      email: emailNorm,
      role: 'user',
      estado: 'activo',
      ...(nombre?.trim() ? { full_name: nombre.trim() }
        : perfilNuevo ? { full_name: emailNorm.split('@')[0] } : {}),
      ...(esClienteDePago ? {} : { plan: 'free', tipo_cuenta: 'operadora' }),
    }, { onConflict: 'id' }).then(null, () => {});

    const { data: op, error: opError } = await supabase
      .from('proyecto_operadores')
      .upsert({
        proyecto_id, user_id: userId, rol: rolFinal,
        email: emailNorm, nombre: nombre || null,
        invitado_por: req.user.id, activo: true,
      }, { onConflict: 'proyecto_id,user_id' })
      .select('id, user_id, rol, email, nombre, activo, created_at')
      .single();
    if (opError) throw opError;

    // Si ya tenía cuenta, avisarle por email de que se le ha dado acceso a un proyecto más.
    if (!esNueva) {
      const resend = getResend();
      if (resend) {
        await resend.emails.send({
          from: `GenChat IA <${process.env.RESEND_FROM_EMAIL || 'noreply@genchats.app'}>`,
          to: emailNorm,
          subject: `Ahora también puedes atender ${proyecto.nombre} en GenChat IA`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">
            <p>Se te ha dado acceso a las conversaciones de <strong>${proyecto.nombre}</strong>. Entra con tu cuenta habitual de GenChat IA.</p>
          </div>`,
        }).catch(() => {});
      }
    }

    res.json({ ok: true, operador: op, cuenta_nueva: esNueva });
  } catch (err) {
    console.error('[operadores] invitar error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/operadores/:id  body: { rol?, activo? }
router.patch('/:id', async (req, res) => {
  try {
    const { data: op } = await supabase
      .from('proyecto_operadores').select('id, proyecto_id').eq('id', req.params.id).single();
    if (!op) return res.status(404).json({ error: 'No encontrada' });

    const puedeGestionar = await canManageOperators(op.proyecto_id, req.user.id);
    if (!puedeGestionar) return res.status(403).json({ error: 'Forbidden' });

    const updates = {};
    if (req.body.rol === 'operador' || req.body.rol === 'supervisor') updates.rol = req.body.rol;
    if (typeof req.body.activo === 'boolean') updates.activo = req.body.activo;

    const { data, error } = await supabase
      .from('proyecto_operadores').update(updates).eq('id', req.params.id)
      .select('id, user_id, rol, email, nombre, activo, created_at').single();
    if (error) throw error;
    res.json({ operador: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/operadores/:id
router.delete('/:id', async (req, res) => {
  try {
    const { data: op } = await supabase
      .from('proyecto_operadores').select('id, proyecto_id').eq('id', req.params.id).single();
    if (!op) return res.status(404).json({ error: 'No encontrada' });

    const puedeGestionar = await canManageOperators(op.proyecto_id, req.user.id);
    if (!puedeGestionar) return res.status(403).json({ error: 'Forbidden' });

    const { error } = await supabase.from('proyecto_operadores').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
