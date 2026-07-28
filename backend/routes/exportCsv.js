/**
 * exportCsv.js — Exportación de datos del proyecto a CSV (leads, conversaciones, reservas).
 *
 * GET /api/export/:tipo?proyecto_id=X&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *
 * Notas de compatibilidad con Excel en español (aprendidas a base de CSV rotos):
 *  · Se emite BOM UTF-8 o Excel en Windows muestra "MartÃ­nez" en vez de "Martínez".
 *  · Separador ';' — con ',' el Excel con configuración regional ES mete la fila
 *    entera en una sola celda.
 *  · Las celdas que empiezan por = + - @ se prefijan con comilla simple: Excel las
 *    interpretaría como fórmula (CSV injection vía contenido de un mensaje).
 */

import express from 'express';
import { supabase } from '../server.js';

const router = express.Router();

const MAX_ROWS  = 50_000;   // techo de seguridad para no reventar memoria
const PAGE_SIZE = 1_000;    // límite por petición de PostgREST

// ── Helpers CSV ────────────────────────────────────────────────────────────

function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;              // anti fórmula
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const head = headers.map(h => csvCell(h.label)).join(';');
  const body = rows.map(r => headers.map(h => csvCell(h.get(r))).join(';'));
  return '\uFEFF' + [head, ...body].join('\r\n') + '\r\n';
}

function fechaHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Pagina sobre PostgREST hasta agotar la tabla o llegar a MAX_ROWS. */
async function fetchAll(build) {
  const out = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return out;
}

// ── Definición de cada exportación ─────────────────────────────────────────

const EXPORTS = {
  leads: {
    fetch: ({ proyectoId, desde, hasta }) => fetchAll(() => {
      let q = supabase.from('leads').select('*')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false });
      if (desde) q = q.gte('created_at', desde);
      if (hasta) q = q.lte('created_at', hasta);
      return q;
    }),
    headers: [
      { label: 'Fecha',           get: r => fechaHora(r.created_at) },
      { label: 'Nombre',          get: r => r.nombre },
      { label: 'Email',           get: r => r.email },
      { label: 'Teléfono',        get: r => r.telefono },
      { label: 'Empresa',         get: r => r.empresa },
      { label: 'Canal',           get: r => r.canal },
      { label: 'Estado',          get: r => r.estado },
      { label: 'Nº mensajes',     get: r => r.mensajes_count },
      { label: 'Último mensaje',  get: r => r.ultimo_mensaje },
      { label: 'Último contacto', get: r => fechaHora(r.last_contact_at) },
      { label: 'Etiquetas',       get: r => Array.isArray(r.tags) ? r.tags.join(', ') : r.tags },
      { label: 'Notas',           get: r => r.notas },
    ],
  },

  conversaciones: {
    fetch: ({ proyectoId, desde, hasta, visitorId }) => fetchAll(() => {
      let q = supabase.from('conversaciones_chat').select('*')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: true });   // orden de lectura natural
      if (visitorId) q = q.eq('visitor_id', visitorId);
      if (desde) q = q.gte('created_at', desde);
      if (hasta) q = q.lte('created_at', hasta);
      return q;
    }),
    headers: [
      { label: 'Fecha',      get: r => fechaHora(r.created_at) },
      { label: 'Contacto',   get: r => r.visitor_id },
      { label: 'Canal',      get: r => r.canal },
      { label: 'Quién',      get: r => (r.role === 'user' ? 'Cliente' : r.role === 'assistant' ? 'Agente' : r.role) },
      { label: 'Mensaje',    get: r => r.content },
    ],
  },

  reservas: {
    fetch: ({ proyectoId, desde, hasta }) => fetchAll(() => {
      let q = supabase.from('reservas')
        .select('*, reservas_recursos(nombre, direccion)')
        .eq('proyecto_id', proyectoId)
        .order('fecha', { ascending: true })
        .order('hora',  { ascending: true });
      if (desde) q = q.gte('fecha', desde);
      if (hasta) q = q.lte('fecha', hasta);
      return q;
    }),
    headers: [
      { label: 'Código',    get: r => r.codigo },
      { label: 'Fecha',     get: r => r.fecha },
      { label: 'Hora',      get: r => (r.hora || '').slice(0, 5) },
      { label: 'Recurso',   get: r => r.reservas_recursos?.nombre },
      { label: 'Dirección', get: r => r.reservas_recursos?.direccion },
      { label: 'Plazas',    get: r => r.unidades },
      { label: 'Nombre',    get: r => r.nombre_cliente },
      { label: 'Teléfono',  get: r => r.telefono_cliente },
      { label: 'Email',     get: r => r.email_cliente },
      { label: 'Documento', get: r => r.documento },
      { label: 'Estado',    get: r => r.estado },
      { label: 'Canal',     get: r => r.canal },
      { label: 'Notas',     get: r => r.notas },
      { label: 'Creada',    get: r => fechaHora(r.created_at) },
    ],
  },
};

// ── Ruta ───────────────────────────────────────────────────────────────────

// GET /api/export/:tipo?proyecto_id=&desde=&hasta=&visitor_id=
router.get('/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    const { proyecto_id, desde, hasta, visitor_id } = req.query;

    const def = EXPORTS[tipo];
    if (!def) {
      return res.status(400).json({ error: `Tipo no válido. Disponibles: ${Object.keys(EXPORTS).join(', ')}` });
    }
    if (!proyecto_id) return res.status(400).json({ error: 'proyecto_id requerido' });

    // Propiedad del proyecto (mismo patrón que el resto de rutas autenticadas)
    const { data: proyecto } = await supabase
      .from('proyectos').select('id, nombre, user_id').eq('id', proyecto_id).single();
    if (!proyecto || proyecto.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const rows = await def.fetch({ proyectoId: proyecto_id, desde, hasta, visitorId: visitor_id });
    const csv  = toCsv(def.headers, rows);

    const slug = (proyecto.nombre || 'proyecto')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const stamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${tipo}-${slug}-${stamp}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[export] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
