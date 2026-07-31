import express from 'express';
import { supabase } from '../server.js';
import { isWindowOpen, sendFreeText, sendTemplate } from '../lib/whatsappSender.js';
import { accessibleProjects, projectForUser } from '../lib/projectAccess.js';

const router = express.Router();
const PROYECTO_COLS = 'id, nombre, user_id, ycloud_api_key, ycloud_phone_number';

// Encode/decode composite conversation ID: "{projectId}~{canal}~{visitorId}"
// Tilde is URL-safe and never appears in UUIDs, canal names, or visitor IDs.
function encodeId(proyecto_id, canal, visitor_id) {
  return `${proyecto_id}~${canal}~${visitor_id}`;
}
function decodeId(id) {
  const firstTilde = id.indexOf('~');
  const secondTilde = id.indexOf('~', firstTilde + 1);
  return {
    proyecto_id: id.slice(0, firstTilde),
    canal: id.slice(firstTilde + 1, secondTilde),
    visitor_id: id.slice(secondTilde + 1),
  };
}

// Aquí había un getYCloudKey/sendYCloud propios, usados solo por el aviso automático de
// "un agente humano se ha unido" que se ha retirado. El envío real vive en lib/whatsappSender.js
// (una sola implementación, con comprobación de la ventana de 24h).

/**
 * Resuelve el contacto real detrás de una o varias conversaciones de voz.
 *
 * En una llamada, `visitor_id` es el call_id de Retell — un identificador opaco, sin
 * teléfono ni nombre. El dato sí existe, pero en la capa de identidad omnicanal:
 * customer_identities(identity_type='retell_call_id') → customers.
 *
 * @returns {Promise<Object>} mapa call_id → { nombre, telefono, email, customer_id }
 */
async function resolverContactosDeVoz(proyectoId, callIds) {
  if (!callIds.length) return {};

  const { data: ids } = await supabase
    .from('customer_identities')
    .select('identity_value, customer_id')
    .eq('proyecto_id', proyectoId)
    .eq('identity_type', 'retell_call_id')
    .in('identity_value', callIds)
    .then(r => r, () => ({ data: [] }));
  if (!ids?.length) return {};

  const { data: customers } = await supabase
    .from('customers')
    .select('id, display_name, primary_phone, primary_email')
    .in('id', [...new Set(ids.map(i => i.customer_id))])
    .then(r => r, () => ({ data: [] }));

  const porId = Object.fromEntries((customers || []).map(c => [c.id, c]));
  const mapa = {};
  for (const i of ids) {
    const c = porId[i.customer_id];
    if (!c) continue;
    mapa[i.identity_value] = {
      customer_id: c.id,
      nombre: c.display_name || null,
      telefono: c.primary_phone || null,
      email: c.primary_email || null,
    };
  }
  return mapa;
}

// GET /api/conversations/customer/:customerId — ficha 360 del contacto.
// Devuelve las conversaciones SEPARADAS por canal: mezclarlas pierde el hilo de cada uno.
// Va antes que las rutas /:id/... para que no las capture.
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('id, proyecto_id, display_name, primary_email, primary_phone, company, status, tags, first_seen_at, last_seen_at')
      .eq('id', req.params.customerId)
      .single()
      .then(r => r, () => ({ data: null }));
    if (!customer) return res.status(404).json({ error: 'Contacto no encontrado' });

    const proyecto = await projectForUser(customer.proyecto_id, req.user.id, { columns: PROYECTO_COLS });
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    const [{ data: convs }, { data: msgs }, { data: identidades }] = await Promise.all([
      supabase.from('customer_conversations')
        .select('id, channel, channel_thread_id, legacy_visitor_id, status, human_takeover, first_message_at, last_message_at')
        .eq('customer_id', customer.id)
        .order('last_message_at', { ascending: false })
        .then(r => r, () => ({ data: [] })),
      supabase.from('customer_messages')
        .select('id, conversation_id, channel, role, content, created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: true })
        .limit(1000)
        .then(r => r, () => ({ data: [] })),
      supabase.from('customer_identities')
        .select('identity_type, identity_value, verified')
        .eq('customer_id', customer.id)
        .then(r => r, () => ({ data: [] })),
    ]);

    const porConversacion = {};
    for (const m of (msgs || [])) (porConversacion[m.conversation_id] ||= []).push(m);

    const canales = {};
    for (const c of (convs || [])) {
      (canales[c.channel] ||= []).push({ ...c, mensajes: porConversacion[c.id] || [] });
    }

    res.json({ customer, identidades: identidades || [], canales, proyecto_nombre: proyecto.nombre });
  } catch (err) {
    console.error('[conversations] customer 360 error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/conversations?projectId=X&canal=todos&page=1&limit=20
router.get('/', async (req, res) => {
  try {
    const { projectId, canal: canalFilter = 'todos', page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Proyectos propios + aquellos donde el usuario es operadora activa
    const { all: proyectos } = await accessibleProjects(req.user.id);
    const filtrados = projectId ? proyectos.filter(p => p.id === projectId) : proyectos;
    if (!filtrados.length) return res.json({ conversations: [], total: 0 });

    const proyectoIds = filtrados.map(p => p.id);
    const proyectoMap = Object.fromEntries(filtrados.map(p => [p.id, p]));

    // Get recent messages to derive conversation list
    let mQuery = supabase
      .from('conversaciones_chat')
      .select('proyecto_id, visitor_id, canal, content, role, created_at')
      .in('proyecto_id', proyectoIds)
      .order('created_at', { ascending: false })
      .limit(2000);
    if (canalFilter && canalFilter !== 'todos') mQuery = mQuery.eq('canal', canalFilter);
    const { data: msgs, error: mErr } = await mQuery;
    if (mErr) throw mErr;

    // Group: last message per (proyecto_id, visitor_id, canal)
    const convMap = {};
    for (const m of (msgs || [])) {
      const key = `${m.proyecto_id}~${m.canal}~${m.visitor_id}`;
      if (!convMap[key]) {
        convMap[key] = {
          id: key,
          proyecto_id: m.proyecto_id,
          visitor_id: m.visitor_id,
          canal: m.canal,
          last_message: m.content,
          last_role: m.role,
          last_message_at: m.created_at,
        };
      }
    }

    // Get takeover states
    const { data: states } = await supabase
      .from('conversaciones')
      .select('proyecto_id, visitor_id, canal, human_takeover, human_takeover_at')
      .in('proyecto_id', proyectoIds)
      .then(r => r, () => ({ data: [] }));

    const stateMap = {};
    for (const s of (states || [])) {
      stateMap[`${s.proyecto_id}~${s.canal}~${s.visitor_id}`] = s;
    }

    const all = Object.values(convMap)
      .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

    const pagina = all.slice(offset, offset + parseInt(limit));

    // Las conversaciones de voz se identifican por call_id: resolvemos el contacto real en
    // lote para no mostrar "call_6a0fbbde…" en la lista.
    const contactosVoz = {};
    const vozPorProyecto = {};
    for (const c of pagina) {
      if (c.canal !== 'phone') continue;
      (vozPorProyecto[c.proyecto_id] ||= []).push(c.visitor_id);
    }
    await Promise.all(Object.entries(vozPorProyecto).map(async ([pid, ids]) => {
      Object.assign(contactosVoz, await resolverContactosDeVoz(pid, ids).catch(() => ({})));
    }));

    const page_items = pagina.map(c => {
      const st = stateMap[c.id] || {};
      return {
        ...c,
        proyecto_nombre: proyectoMap[c.proyecto_id]?.nombre || 'Proyecto',
        human_takeover: st.human_takeover || false,
        human_takeover_at: st.human_takeover_at || null,
        contacto: contactosVoz[c.visitor_id] || null,
      };
    });

    res.json({ conversations: page_items, total: all.length });
  } catch (err) {
    console.error('[conversations] list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/conversations/:id/messages?page=1&limit=50
router.get('/:id/messages', async (req, res) => {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const { page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const proyecto = await projectForUser(proyecto_id, req.user.id, { columns: PROYECTO_COLS });
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    const { data: messages, error } = await supabase
      .from('conversaciones_chat')
      .select('id, role, content, created_at, canal')
      .eq('proyecto_id', proyecto_id)
      .eq('visitor_id', visitor_id)
      .eq('canal', canal)
      .order('created_at', { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    // Get takeover state
    const { data: st } = await supabase
      .from('conversaciones')
      .select('human_takeover, human_takeover_at')
      .eq('proyecto_id', proyecto_id)
      .eq('visitor_id', visitor_id)
      .eq('canal', canal)
      .maybeSingle()
      .then(r => r, () => ({ data: null }));

    // Último mensaje ENTRANTE: es lo que marca la ventana de 24h en el composer del inbox.
    const { data: ultimoEntrante } = await supabase
      .from('conversaciones_chat')
      .select('created_at')
      .eq('proyecto_id', proyecto_id).eq('visitor_id', visitor_id).eq('canal', canal)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
      .then(r => r, () => ({ data: null }));

    // En una llamada el visitor_id es el call_id de Retell, opaco: resolvemos quién llamó.
    const contacto = canal === 'phone'
      ? (await resolverContactosDeVoz(proyecto_id, [visitor_id]).catch(() => ({})))[visitor_id] || null
      : null;

    res.json({
      messages: messages || [],
      human_takeover: st?.human_takeover || false,
      ultimo_entrante_at: ultimoEntrante?.created_at || null,
      contacto,
      proyecto_id, visitor_id, canal,
    });
  } catch (err) {
    console.error('[conversations] messages error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/conversations/:id/takeover  body: { human_takeover: boolean }
router.patch('/:id/takeover', async (req, res) => {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const { human_takeover } = req.body;

    const proyecto = await projectForUser(proyecto_id, req.user.id, { columns: PROYECTO_COLS });
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    const now = new Date().toISOString();
    const { data: updated, error: uErr } = await supabase
      .from('conversaciones')
      .upsert({
        proyecto_id, visitor_id, canal,
        human_takeover,
        human_takeover_at: human_takeover ? now : null,
        last_message_at: now,
      }, { onConflict: 'proyecto_id,visitor_id,canal' })
      .select()
      .single();
    if (uErr) throw uErr;

    // Antes se enviaba automáticamente "Un agente humano se ha unido a la conversación" al
    // tomar el control. Retirado a propósito: en una bandeja compartida con varias operadoras
    // entrando y saliendo, eso es ruido para el cliente. Además iba como texto libre sin
    // comprobar la ventana de 24h, así que en conversaciones antiguas fallaba en silencio.
    // La operadora escribe cuando quiera; el cliente lo nota por el propio mensaje.

    res.json({ ok: true, human_takeover: updated.human_takeover });
  } catch (err) {
    console.error('[conversations] takeover error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/conversations/:id/message  body: { text: string }
router.post('/:id/message', async (req, res) => {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text required' });

    const proyecto = await projectForUser(proyecto_id, req.user.id, { columns: PROYECTO_COLS });
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    // Verify human takeover is active
    const { data: st } = await supabase
      .from('conversaciones')
      .select('human_takeover')
      .eq('proyecto_id', proyecto_id)
      .eq('visitor_id', visitor_id)
      .eq('canal', canal)
      .maybeSingle()
      .then(r => r, () => ({ data: null }));
    if (!st?.human_takeover) return res.status(400).json({ error: 'Human takeover not active for this conversation' });

    // Texto libre solo si el cliente escribió en las últimas 24h — si no, Meta lo rechaza.
    let sent = false;
    if (canal === 'whatsapp') {
      if (!(await isWindowOpen(proyecto_id, visitor_id))) {
        return res.status(409).json({ error: 'ventana_cerrada', mensaje: 'Han pasado más de 24h desde el último mensaje del cliente. Usa una plantilla para reabrir la conversación.' });
      }
      try {
        await sendFreeText(proyecto, visitor_id, text);
        sent = true;
      } catch (err) {
        return res.status(502).json({ error: err.message });
      }
    }

    // Save to message history
    await supabase.from('conversaciones_chat').insert({
      proyecto_id, visitor_id, canal, role: 'assistant', content: text,
    }).then(null, () => {});

    // Update last_message_at
    await supabase.from('conversaciones')
      .update({ last_message_at: new Date().toISOString() })
      .eq('proyecto_id', proyecto_id).eq('visitor_id', visitor_id).eq('canal', canal)
      .then(null, () => {});

    res.json({ ok: true, sent });
  } catch (err) {
    console.error('[conversations] send message error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/conversations/:id/ventana — ¿se puede mandar texto libre o hace falta plantilla?
router.get('/:id/ventana', async (req, res) => {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const proyecto = await projectForUser(proyecto_id, req.user.id, { columns: PROYECTO_COLS });
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });
    if (canal !== 'whatsapp') return res.json({ open: true }); // web/telegram no tienen ventana de 24h

    const open = await isWindowOpen(proyecto_id, visitor_id);
    res.json({ open });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/conversations/:id/plantilla — reabrir con una plantilla aprobada de Meta
router.post('/:id/plantilla', async (req, res) => {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const { name, language, params, bodyPreview } = req.body;
    if (!name) return res.status(400).json({ error: 'name requerido' });
    if (canal !== 'whatsapp') return res.status(400).json({ error: 'Solo aplica a conversaciones de WhatsApp' });

    const proyecto = await projectForUser(proyecto_id, req.user.id, { columns: PROYECTO_COLS });
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    const { data: st } = await supabase
      .from('conversaciones')
      .select('human_takeover')
      .eq('proyecto_id', proyecto_id).eq('visitor_id', visitor_id).eq('canal', canal)
      .maybeSingle().then(r => r, () => ({ data: null }));
    if (!st?.human_takeover) return res.status(400).json({ error: 'Human takeover not active for this conversation' });

    await sendTemplate(proyecto, visitor_id, {
      name, language: language || 'es', params: params || [], bodyText: bodyPreview,
    });

    await supabase.from('conversaciones_chat').insert({
      proyecto_id, visitor_id, canal, role: 'assistant', content: bodyPreview || `[plantilla: ${name}]`,
    }).then(null, () => {});
    await supabase.from('conversaciones')
      .update({ last_message_at: new Date().toISOString() })
      .eq('proyecto_id', proyecto_id).eq('visitor_id', visitor_id).eq('canal', canal)
      .then(null, () => {});

    res.json({ ok: true });
  } catch (err) {
    console.error('[conversations] send template error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Notas internas de la conversación (visibles solo para el equipo, nunca al cliente) ──

// GET /api/conversations/:id/notas
// ── Plantillas disponibles para el composer ────────────────────────────────
// Une dos cosas que NO son intercambiables:
//   · hsm    → aprobadas por Meta. Se envían SIEMPRE, también fuera de la ventana de 24h.
//   · rapida → respuestas predefinidas locales (lead_templates). Son texto normal, así que
//              SOLO valen dentro de la ventana.
const HSM_CACHE = new Map();          // proyecto_id → { ts, items }
const HSM_CACHE_TTL = 10 * 60 * 1000;

async function fetchPlantillasHsm(proyecto) {
  const { data: full } = await supabase
    .from('proyectos').select('id, ycloud_api_key, ycloud_waba_id').eq('id', proyecto.id).single()
    .then(r => r, () => ({ data: null }));
  if (!full?.ycloud_waba_id) return [];

  const cached = HSM_CACHE.get(proyecto.id);
  if (cached && Date.now() - cached.ts < HSM_CACHE_TTL) return cached.items;

  let apiKey = full.ycloud_api_key;
  if (!apiKey) {
    const { data: cfg } = await supabase
      .from('config_plataforma').select('ycloud_api_key').eq('clave', 'plataforma').single()
      .then(r => r, () => ({ data: null }));
    apiKey = cfg?.ycloud_api_key;
  }
  if (!apiKey) return [];

  const ycRes = await fetch(
    `https://api.ycloud.com/v2/whatsapp/templates?wabaId=${encodeURIComponent(full.ycloud_waba_id)}&limit=100`,
    { headers: { 'X-API-Key': apiKey } }
  );
  if (!ycRes.ok) return cached?.items || [];
  const data = await ycRes.json();

  const items = (data.items || [])
    .filter(t => String(t.status).toUpperCase() === 'APPROVED')
    .map(t => {
      const body = (t.components || []).find(c => String(c.type).toUpperCase() === 'BODY');
      const texto = body?.text || '';
      const variables = [...new Set((texto.match(/\{\{\d+\}\}/g) || []))]
        .map(v => parseInt(v.replace(/\D/g, ''), 10)).sort((a, b) => a - b);
      return {
        id: `hsm:${t.name}:${t.language}`, tipo: 'hsm', nombre: t.name,
        contenido: texto, variables,
        wa_template_name: t.name, wa_language: t.language,
      };
    });

  HSM_CACHE.set(proyecto.id, { ts: Date.now(), items });
  return items;
}

// GET /api/conversations/:id/plantillas
router.get('/:id/plantillas', async (req, res) => {
  try {
    const { proyecto_id, canal } = decodeId(req.params.id);
    const proyecto = await projectForUser(proyecto_id, req.user.id, { columns: PROYECTO_COLS });
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    const [hsm, rapidasRes] = await Promise.all([
      canal === 'whatsapp' ? fetchPlantillasHsm(proyecto).catch(() => []) : Promise.resolve([]),
      supabase.from('lead_templates')
        .select('id, name, content, category')
        .eq('user_id', req.user.id).order('name')
        .then(r => r, () => ({ data: [] })),
    ]);

    const rapidas = (rapidasRes.data || []).map(t => ({
      id: `rapida:${t.id}`, tipo: 'rapida', nombre: t.name,
      contenido: t.content, variables: [], categoria: t.category || 'general',
    }));

    res.json({ plantillas: [...hsm, ...rapidas], hsm_disponibles: hsm.length });
  } catch (err) {
    console.error('[conversations] plantillas error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/notas', async (req, res) => {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const proyecto = await projectForUser(proyecto_id, req.user.id, { columns: PROYECTO_COLS });
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    const { data, error } = await supabase
      .from('conversacion_notas')
      .select('id, contenido, autor_nombre, created_at')
      .eq('proyecto_id', proyecto_id).eq('visitor_id', visitor_id).eq('canal', canal)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ notas: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/conversations/:id/notas
router.post('/:id/notas', async (req, res) => {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const { contenido } = req.body;
    if (!contenido?.trim()) return res.status(400).json({ error: 'contenido requerido' });

    const proyecto = await projectForUser(proyecto_id, req.user.id, { columns: PROYECTO_COLS });
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    const autorNombre = req.user.user_metadata?.full_name || req.user.email || 'Operador';
    const { data, error } = await supabase
      .from('conversacion_notas')
      .insert({ proyecto_id, canal, visitor_id, contenido: contenido.trim(), autor_id: req.user.id, autor_nombre: autorNombre })
      .select('id, contenido, autor_nombre, created_at')
      .single();
    if (error) throw error;
    res.json({ nota: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/conversations/:id/notas/:notaId
router.delete('/:id/notas/:notaId', async (req, res) => {
  try {
    const { proyecto_id } = decodeId(req.params.id);
    const proyecto = await projectForUser(proyecto_id, req.user.id, { columns: PROYECTO_COLS });
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    const { error } = await supabase.from('conversacion_notas').delete()
      .eq('id', req.params.notaId).eq('proyecto_id', proyecto_id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
