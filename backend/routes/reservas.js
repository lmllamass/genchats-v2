/**
 * reservas.js — API de gestión del motor de reservas para el panel.
 *
 * Las tablas reservas_* tienen RLS solo para service_role, así que el frontend NO puede
 * leerlas con la clave anónima: todo pasa por aquí, validando siempre que el proyecto
 * sea del usuario autenticado.
 */

import express from 'express';
import { supabase } from '../server.js';

const router = express.Router();

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

async function proyectoDelUsuario(proyectoId, userId) {
  if (!proyectoId) return null;
  const { data } = await supabase
    .from('proyectos').select('id, nombre, user_id').eq('id', proyectoId).single();
  return data && data.user_id === userId ? data : null;
}

/** Comprueba la propiedad a partir de un recurso (que cuelga de un proyecto). */
async function recursoDelUsuario(recursoId, userId) {
  if (!recursoId) return null;
  const { data } = await supabase
    .from('reservas_recursos')
    .select('id, proyecto_id, nombre, proyectos(user_id)')
    .eq('id', recursoId).single();
  return data && data.proyectos?.user_id === userId ? data : null;
}

// ── Recursos ───────────────────────────────────────────────────────────────

// GET /api/reservas/recursos?proyecto_id=X
router.get('/recursos', async (req, res) => {
  try {
    const proyecto = await proyectoDelUsuario(req.query.proyecto_id, req.user.id);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const { data: recursos, error } = await supabase
      .from('reservas_recursos')
      .select('*, reservas_franjas(id, dia_semana, hora, capacidad, duracion_min, etiqueta, activa)')
      .eq('proyecto_id', proyecto.id)
      .order('nombre');
    if (error) throw new Error(error.message);

    // Ordena las franjas por día y hora — Supabase no ordena las relaciones anidadas
    for (const r of recursos || []) {
      r.reservas_franjas = (r.reservas_franjas || []).sort(
        (a, b) => a.dia_semana - b.dia_semana || String(a.hora).localeCompare(String(b.hora)));
    }
    res.json({ recursos: recursos || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reservas/recursos
router.post('/recursos', async (req, res) => {
  try {
    const { proyecto_id, nombre, direccion, maps_url, calendar_id } = req.body;
    const proyecto = await proyectoDelUsuario(proyecto_id, req.user.id);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const { data, error } = await supabase.from('reservas_recursos').insert({
      proyecto_id, nombre: nombre.trim(),
      direccion: direccion?.trim() || null,
      maps_url: maps_url?.trim() || null,
      calendar_id: calendar_id?.trim() || null,
    }).select().single();
    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'Ya existe un recurso con ese nombre' });
      throw new Error(error.message);
    }
    res.json({ recurso: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/reservas/recursos/:id
router.patch('/recursos/:id', async (req, res) => {
  try {
    const recurso = await recursoDelUsuario(req.params.id, req.user.id);
    if (!recurso) return res.status(404).json({ error: 'Recurso no encontrado' });

    const campos = {};
    for (const k of ['nombre', 'direccion', 'maps_url', 'calendar_id', 'activo']) {
      if (k in req.body) campos[k] = typeof req.body[k] === 'string' ? (req.body[k].trim() || null) : req.body[k];
    }
    const { data, error } = await supabase.from('reservas_recursos')
      .update(campos).eq('id', recurso.id).select().single();
    if (error) throw new Error(error.message);
    res.json({ recurso: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reservas/recursos/:id
router.delete('/recursos/:id', async (req, res) => {
  try {
    const recurso = await recursoDelUsuario(req.params.id, req.user.id);
    if (!recurso) return res.status(404).json({ error: 'Recurso no encontrado' });

    // Aviso: borrar el recurso arrastra sus reservas (ON DELETE CASCADE)
    const { count } = await supabase.from('reservas')
      .select('id', { count: 'exact', head: true })
      .eq('recurso_id', recurso.id).eq('estado', 'confirmada');
    if (count > 0 && !req.query.forzar) {
      return res.status(409).json({
        error: `Ese recurso tiene ${count} reserva(s) confirmada(s). Se borrarán también.`,
        requiere_confirmacion: true, reservas: count,
      });
    }
    const { error } = await supabase.from('reservas_recursos').delete().eq('id', recurso.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Franjas ────────────────────────────────────────────────────────────────

// POST /api/reservas/franjas  — admite varios días de golpe (dias: [1,2,3])
router.post('/franjas', async (req, res) => {
  try {
    const { recurso_id, dias, hora, capacidad, duracion_min, etiqueta } = req.body;
    const recurso = await recursoDelUsuario(recurso_id, req.user.id);
    if (!recurso) return res.status(404).json({ error: 'Recurso no encontrado' });

    const listaDias = Array.isArray(dias) ? dias.map(Number).filter(d => d >= 1 && d <= 7) : [];
    if (!listaDias.length) return res.status(400).json({ error: 'Elige al menos un día de la semana' });
    if (!hora) return res.status(400).json({ error: 'La hora es obligatoria' });
    const cap = Number(capacidad);
    if (!cap || cap < 1) return res.status(400).json({ error: 'La capacidad debe ser mayor que 0' });

    const filas = listaDias.map(d => ({
      recurso_id, dia_semana: d, hora: String(hora).slice(0, 5),
      capacidad: cap,
      duracion_min: Number(duracion_min) || 60,
      etiqueta: etiqueta?.trim() || null,
    }));
    // upsert para que repetir un día ya existente actualice en vez de fallar
    const { data, error } = await supabase.from('reservas_franjas')
      .upsert(filas, { onConflict: 'recurso_id,dia_semana,hora' }).select();
    if (error) throw new Error(error.message);
    res.json({ franjas: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reservas/franjas/:id
router.delete('/franjas/:id', async (req, res) => {
  try {
    const { data: franja } = await supabase
      .from('reservas_franjas')
      .select('id, recurso_id, reservas_recursos(proyectos(user_id))')
      .eq('id', req.params.id).single();
    if (!franja || franja.reservas_recursos?.proyectos?.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Franja no encontrada' });
    }
    const { error } = await supabase.from('reservas_franjas').delete().eq('id', franja.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Reservas ───────────────────────────────────────────────────────────────

// GET /api/reservas?proyecto_id=X&desde=&hasta=&estado=
router.get('/', async (req, res) => {
  try {
    const proyecto = await proyectoDelUsuario(req.query.proyecto_id, req.user.id);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    let q = supabase.from('reservas')
      .select('*, reservas_recursos(nombre, direccion)')
      .eq('proyecto_id', proyecto.id)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true })
      .limit(500);
    if (req.query.desde)  q = q.gte('fecha', req.query.desde);
    if (req.query.hasta)  q = q.lte('fecha', req.query.hasta);
    if (req.query.estado) q = q.eq('estado', req.query.estado);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    res.json({ reservas: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reservas/:codigo/cancelar — cancelación manual desde el panel
router.post('/:codigo/cancelar', async (req, res) => {
  try {
    const proyecto = await proyectoDelUsuario(req.body.proyecto_id, req.user.id);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const { data, error } = await supabase.rpc('reservas_cancelar', {
      p_proyecto: proyecto.id,
      p_codigo: req.params.codigo,
      p_motivo: req.body.motivo || 'Cancelada desde el panel',
    });
    if (error) throw new Error(error.message);
    if (!data?.ok) return res.status(400).json({ error: data?.motivo || 'No se pudo cancelar' });
    res.json({ ok: true, resultado: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { DIAS };
export default router;
