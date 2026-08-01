import express from 'express';
import { Resend } from 'resend';
import { supabase } from '../server.js';
import { checkCalendarAccess, getServiceAccountEmail } from '../lib/googleCalendar.js';

const router = express.Router();

// GET /api/admin/config - get platform config
router.get('/config', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('config_plataforma')
      .select('*')
      .eq('clave', 'plataforma')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/config - update platform config
router.put('/config', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('config_plataforma')
      .update(req.body)
      .eq('clave', 'plataforma')
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/usuarios
// Returns merged auth + user_profiles data (service role bypasses RLS).
// Auto-creates profile rows for auth users that don't have one yet.
router.get('/usuarios', async (req, res) => {
  try {
    // 1. All auth users (service role, max 1000)
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) return res.status(500).json({ error: authErr.message });

    // 2. All profiles (service role key → no RLS restriction)
    const { data: profiles } = await supabase.from('user_profiles').select('*');
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    // 3. Build merged list + detect missing profiles
    const toCreate = [];
    const users = (authData.users || []).map(u => {
      const p = profileMap[u.id];
      if (!p) {
        toCreate.push({
          id: u.id,
          email: u.email,
          full_name: u.user_metadata?.full_name || u.email?.split('@')[0] || '',
          role: 'user',
          plan: 'free',
          estado: 'activo',
          created_at: u.created_at,
        });
      }
      return {
        id: u.id,
        email: p?.email || u.email,
        created_at: p?.created_at || u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        full_name: p?.full_name || u.user_metadata?.full_name || u.email?.split('@')[0] || '',
        role: p?.role || 'user',
        plan: p?.plan || 'free',
        estado: p?.estado || 'activo',
        trial_ends_at: p?.trial_ends_at || null,
        plan_activated_at: p?.plan_activated_at || null,
        telefono: p?.telefono || null,
        empresa: p?.empresa || null,
        direccion: p?.direccion || null,
        notas_admin: p?.notas_admin || null,
        stripe_customer_id: p?.stripe_customer_id || null,
        stripe_subscription_id: p?.stripe_subscription_id || null,
      };
    });

    // 4. Auto-create missing profiles (fire-and-forget, won't block response)
    if (toCreate.length > 0) {
      supabase.from('user_profiles').insert(toCreate).catch(() => {});
    }

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/usuarios/:id — update user profile (service role, bypasses RLS)
router.patch('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('user_profiles')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/proyectos
router.get('/proyectos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Máximo de chatbots por plan. El frontend tiene su propia copia para pintar la UI, pero
// la fuente de verdad para transferir tiene que estar en servidor.
const MAX_PROYECTOS = { free: 1, gratis: 1, basico: 3, pro: 3, 'super-pro': 5, super_pro: 5 };

// POST /api/admin/proyectos/:id/transferir — cambia el propietario de un chatbot.
//
// Caso de uso: se configura el chatbot con la cuenta de admin antes de que el cliente
// pague, y al pagar se le traspasa ya montado.
//
// Casi todo cuelga de `proyecto_id` (conversaciones, leads, reservas, notas, canales), así
// que viaja solo. Lo que NO viaja por sí mismo y se arregla aquí:
//   · customers.user_id — se copia del proyecto al crear cada contacto, quedaría desfasado.
//   · lead_templates    — están scoped por usuario, no por proyecto: se COPIAN (no se mueven,
//                         porque el dueño original puede tener otros chatbots usándolas).
router.post('/proyectos/:id/transferir', async (req, res) => {
  try {
    const { id } = req.params;
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Falta el email del destinatario' });

    const { data: proyecto } = await supabase
      .from('proyectos').select('id, nombre, user_id').eq('id', id).single()
      .then(r => r, () => ({ data: null }));
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    // El email real vive en auth.users: el trigger de alta no lo copia a user_profiles.
    const { data: lista, error: authErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authErr) throw new Error(authErr.message);
    const destino = (lista.users || []).find(u => (u.email || '').toLowerCase() === email);
    if (!destino) return res.status(404).json({ error: `No hay ninguna cuenta con el email ${email}` });
    if (destino.id === proyecto.user_id) return res.status(400).json({ error: 'El proyecto ya es de esa cuenta' });

    // Límite de chatbots del destinatario — se comprueba al crear, no al recibir.
    const { data: perfil } = await supabase
      .from('user_profiles').select('plan').eq('id', destino.id).single()
      .then(r => r, () => ({ data: null }));
    const plan = perfil?.plan || 'free';
    const max = MAX_PROYECTOS[plan] ?? 1;
    const { count: yaTiene } = await supabase
      .from('proyectos').select('id', { count: 'exact', head: true }).eq('user_id', destino.id);
    if ((yaTiene || 0) >= max) {
      return res.status(409).json({
        error: `${email} ya tiene ${yaTiene} chatbot(s) y su plan (${plan}) permite ${max}. Sube su plan antes de transferir.`,
      });
    }

    const propietarioAnterior = proyecto.user_id;

    // 1. Propiedad del proyecto
    const { error: upErr } = await supabase
      .from('proyectos').update({ user_id: destino.id }).eq('id', id);
    if (upErr) throw new Error(upErr.message);

    // 2. Contactos omnicanal de ese proyecto
    await supabase.from('customers').update({ user_id: destino.id }).eq('proyecto_id', id)
      .then(null, () => {});

    // 3. Copia de las plantillas de respuesta rápida, sin duplicar las que ya tenga
    let plantillasCopiadas = 0;
    if (propietarioAnterior) {
      const [{ data: origen }, { data: yaTeniaTpl }] = await Promise.all([
        supabase.from('lead_templates').select('name, content, category').eq('user_id', propietarioAnterior)
          .then(r => r, () => ({ data: [] })),
        supabase.from('lead_templates').select('name').eq('user_id', destino.id)
          .then(r => r, () => ({ data: [] })),
      ]);
      const existentes = new Set((yaTeniaTpl || []).map(t => t.name));
      const nuevas = (origen || []).filter(t => !existentes.has(t.name))
        .map(t => ({ user_id: destino.id, name: t.name, content: t.content, category: t.category }));
      if (nuevas.length) {
        const { error } = await supabase.from('lead_templates').insert(nuevas);
        if (!error) plantillasCopiadas = nuevas.length;
      }
    }

    console.log(`🔄 Proyecto ${proyecto.nombre} (${id}) transferido de ${propietarioAnterior} a ${destino.id} (${email})`);
    res.json({
      ok: true,
      proyecto: proyecto.nombre,
      nuevo_propietario: { id: destino.id, email },
      propietario_anterior: propietarioAnterior,
      plantillas_copiadas: plantillasCopiadas,
    });
  } catch (err) {
    console.error('[admin] transferir proyecto error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/proyectos/:id — update any project (service role bypasses RLS)
router.patch('/proyectos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('proyectos')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/invitar - invite a user by email
router.post('/invitar', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('[invitar] Received request, email:', email);
    if (!email) return res.status(400).json({ error: 'email required' });

    const siteUrl = process.env.APP_URL || 'https://v2.genchats.app';
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@genchats.app';

    // Generate a magic invite link via Supabase Admin API
    let linkData, linkError;
    ({ data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${siteUrl}/reset-password` },
    }));

    // If user already exists, send a password reset link instead
    if (linkError?.code === 'email_exists' || linkError?.status === 422) {
      console.log('[invitar] User exists, sending recovery link instead');
      ({ data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${siteUrl}/reset-password` },
      }));
    }

    if (linkError) {
      console.error('[invitar] generateLink error:', linkError);
      return res.status(400).json({ error: linkError.message });
    }

    const inviteUrl = linkData?.properties?.action_link || linkData?.action_link;
    console.log('[invitar] Invite URL generated:', inviteUrl ? 'yes' : 'no');

    // Ensure user_profiles row exists
    if (linkData?.user?.id) {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', linkData.user.id)
        .single();
      if (!existing) {
        await supabase.from('user_profiles').insert({
          id: linkData.user.id,
          email,
          full_name: email.split('@')[0],
          role: 'user',
          plan: 'free',
          estado: 'activo',
        }).catch(() => {});
      }
    }

    // Send email via Resend API (not SMTP - direct API call)
    if (resendKey && inviteUrl) {
      const resend = new Resend(resendKey);
      const { error: emailError } = await resend.emails.send({
        from: `GenChat IA <noreply@genchats.app>`,
        to: email,
        subject: 'Te han invitado a GenChat IA',
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">
            <h2 style="color:#7c3aed">¡Has sido invitado a GenChat IA!</h2>
            <p>Haz clic en el botón para crear tu cuenta y empezar a usar la plataforma:</p>
            <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
              Activar mi cuenta
            </a>
            <p style="color:#6b7280;font-size:14px">Si no esperabas esta invitación, puedes ignorar este email.</p>
            <p style="color:#6b7280;font-size:12px">El enlace expira en 24 horas.</p>
          </div>
        `,
      });
      if (emailError) {
        console.error('[invitar] Resend email error:', emailError);
        return res.status(500).json({ error: 'No se pudo enviar el email: ' + emailError.message });
      }
      console.log('[invitar] Email sent via Resend to:', email);
    } else if (!inviteUrl) {
      console.error('[invitar] No invite URL generated');
      return res.status(500).json({ error: 'No se pudo generar el enlace de invitación' });
    } else {
      console.warn('[invitar] No RESEND_API_KEY, skipping email');
    }

    res.json({ ok: true, email });
  } catch (err) {
    console.error('[invitar] Unexpected error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/reset-mensajes - reset monthly message counter
router.post('/reset-mensajes', async (req, res) => {
  try {
    const { error } = await supabase
      .from('proyectos')
      .update({ mensajes_mes: 0 })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, message: 'Contadores reseteados' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/telegram/registrar-webhook
// Registers (or re-registers) a Telegram bot webhook pointing to our backend.
router.post('/telegram/registrar-webhook', async (req, res) => {
  try {
    const { proyecto_id } = req.body;
    if (!proyecto_id) return res.status(400).json({ error: 'proyecto_id required' });

    const { data: proyecto, error: pErr } = await supabase
      .from('proyectos').select('id, telegram_token').eq('id', proyecto_id).single();
    if (pErr || !proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const botToken = proyecto.telegram_token;
    if (!botToken) return res.status(400).json({ error: 'El proyecto no tiene telegram_token configurado' });

    const apiUrl = process.env.API_PUBLIC_URL || 'https://api-v2.genchats.app';
    const webhookUrl = `${apiUrl}/api/telegram/webhook/${proyecto_id}`;

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] }),
    });
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return res.status(400).json({ error: tgData.description || 'Telegram API error' });
    }

    res.json({ ok: true, webhook_url: webhookUrl, telegram: tgData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Project Tools (Actions Engine) ─────────────────────────────────────────

// GET /api/admin/proyectos/:id/tools
router.get('/proyectos/:id/tools', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('project_tools')
      .select('*')
      .eq('project_id', req.params.id)
      .order('tool_name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/proyectos/:id/tools — upsert tool config
router.post('/proyectos/:id/tools', async (req, res) => {
  try {
    const { tool_name, enabled = false, config = {} } = req.body;
    if (!tool_name) return res.status(400).json({ error: 'tool_name required' });
    const { data, error } = await supabase
      .from('project_tools')
      .upsert({ project_id: req.params.id, tool_name, enabled, config },
               { onConflict: 'project_id,tool_name' })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/proyectos/:id/tools/:toolId
router.patch('/proyectos/:id/tools/:toolId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('project_tools')
      .update(req.body)
      .eq('id', req.params.toolId)
      .eq('project_id', req.params.id)
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/proyectos/:id/tools/:toolId
router.delete('/proyectos/:id/tools/:toolId', async (req, res) => {
  try {
    const { error } = await supabase
      .from('project_tools')
      .delete()
      .eq('id', req.params.toolId)
      .eq('project_id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Google Calendar (concertar_cita) ───────────────────────────────────────

// GET /api/admin/google-calendar/service-account-email
router.get('/google-calendar/service-account-email', (req, res) => {
  res.json({ email: getServiceAccountEmail() });
});

// POST /api/admin/google-calendar/check — { calendar_id } → confirma que tenemos acceso real
router.post('/google-calendar/check', async (req, res) => {
  const { calendar_id } = req.body;
  const result = await checkCalendarAccess(calendar_id);
  res.json(result);
});

export default router;
