import express from 'express';
import { supabase } from '../server.js';

const router = express.Router();

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

async function ownedProject(proyecto_id, userId) {
  const { data } = await supabase
    .from('proyectos')
    .select('id, nombre, user_id, ycloud_api_key, ycloud_phone_number')
    .eq('id', proyecto_id)
    .single();
  if (!data || data.user_id !== userId) return null;
  return data;
}

async function getYCloudKey(proyecto) {
  if (proyecto.ycloud_api_key) return proyecto.ycloud_api_key;
  const { data: cfg } = await supabase
    .from('config_plataforma').select('ycloud_api_key').eq('clave', 'plataforma').single();
  return cfg?.ycloud_api_key || null;
}

async function sendYCloud(to, text, apiKey, fromNumber) {
  try {
    const res = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromNumber, to, type: 'text', text: { body: text } }),
    });
    return res.ok;
  } catch (_) { return false; }
}

/** Envía una plantilla HSM aprobada. A diferencia del texto libre, funciona fuera de la ventana de 24h. */
async function sendYCloudTemplate(to, { name, language, valores = [] }, apiKey, fromNumber) {
  try {
    const components = valores.length
      ? [{ type: 'body', parameters: valores.map(v => ({ type: 'text', text: String(v) })) }]
      : [];
    const res = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromNumber, to, type: 'template',
        template: { name, language: { code: language }, components },
      }),
    });
    return res.ok;
  } catch (_) { return false; }
}

/** Sustituye {{1}}, {{2}}… por los valores dados, para guardar el texto real en el historial. */
function renderPlantilla(texto, valores = []) {
  return String(texto).replace(/\{\{(\d+)\}\}/g, (m, n) => valores[parseInt(n, 10) - 1] ?? m);
}

// GET /api/conversations?projectId=X&canal=todos&page=1&limit=20
router.get('/', async (req, res) => {
  try {
    const { projectId, canal: canalFilter = 'todos', page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch user's projects
    let pQuery = supabase.from('proyectos').select('id, nombre, user_id').eq('user_id', req.user.id);
    if (projectId) pQuery = pQuery.eq('id', projectId);
    const { data: proyectos, error: pErr } = await pQuery;
    if (pErr) throw pErr;
    if (!proyectos?.length) return res.json({ conversations: [], total: 0 });

    const proyectoIds = proyectos.map(p => p.id);
    const proyectoMap = Object.fromEntries(proyectos.map(p => [p.id, p]));

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

    const page_items = all.slice(offset, offset + parseInt(limit)).map(c => {
      const st = stateMap[c.id] || {};
      return {
        ...c,
        proyecto_nombre: proyectoMap[c.proyecto_id]?.nombre || 'Proyecto',
        human_takeover: st.human_takeover || false,
        human_takeover_at: st.human_takeover_at || null,
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

    const proyecto = await ownedProject(proyecto_id, req.user.id);
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    const { data: messages, error } = await supabase
      .from('conversaciones_chat')
      .select('id, role, content, created_at')
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

    // Ventana de 24h de WhatsApp: se mide desde el último mensaje ENTRANTE del cliente
    // (role 'user'). Enviar una plantilla NO abre la ventana — solo la respuesta del cliente.
    const { data: ultimoEntrante } = await supabase
      .from('conversaciones_chat')
      .select('created_at')
      .eq('proyecto_id', proyecto_id)
      .eq('visitor_id', visitor_id)
      .eq('canal', canal)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(r => r, () => ({ data: null }));

    res.json({
      messages: messages || [],
      human_takeover: st?.human_takeover || false,
      ultimo_entrante_at: ultimoEntrante?.created_at || null,
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

    const proyecto = await ownedProject(proyecto_id, req.user.id);
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

    // Notify customer when human agent takes over WhatsApp conversation
    if (human_takeover && canal === 'whatsapp') {
      const apiKey = await getYCloudKey(proyecto);
      if (apiKey && proyecto.ycloud_phone_number) {
        await sendYCloud(visitor_id, 'Un agente humano se ha unido a la conversación.', apiKey, proyecto.ycloud_phone_number);
      }
    }

    res.json({ ok: true, human_takeover: updated.human_takeover });
  } catch (err) {
    console.error('[conversations] takeover error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/conversations/:id/message
//   body: { text }                                        → texto libre (solo dentro de 24h)
//   body: { plantilla: { name, language, valores: [] } }   → plantilla HSM (siempre válida)
router.post('/:id/message', async (req, res) => {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const { text, plantilla } = req.body;
    if (!plantilla && !text?.trim()) return res.status(400).json({ error: 'text required' });
    if (plantilla && (!plantilla.name || !plantilla.language)) {
      return res.status(400).json({ error: 'La plantilla necesita name y language' });
    }

    const proyecto = await ownedProject(proyecto_id, req.user.id);
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

    // El texto libre solo llega si la ventana de 24h sigue abierta. Se valida en servidor
    // además de en la UI: si no, YCloud acepta el envío y Meta lo descarta después (131047),
    // y el agente cree que ha contestado cuando en realidad no ha salido nada.
    if (!plantilla && canal === 'whatsapp') {
      const { data: ultimoEntrante } = await supabase
        .from('conversaciones_chat')
        .select('created_at')
        .eq('proyecto_id', proyecto_id).eq('visitor_id', visitor_id).eq('canal', canal)
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()
        .then(r => r, () => ({ data: null }));
      const abierta = ultimoEntrante?.created_at
        && (Date.now() - new Date(ultimoEntrante.created_at).getTime()) < 24 * 60 * 60 * 1000;
      if (!abierta) {
        return res.status(409).json({
          error: 'ventana_cerrada',
          mensaje: 'Han pasado más de 24 h desde el último mensaje del cliente. Solo puedes enviar una plantilla aprobada.',
        });
      }
    }

    const contenido = plantilla
      ? renderPlantilla(plantilla.contenido || plantilla.name, plantilla.valores)
      : text;

    // Send via YCloud for WhatsApp
    let sent = false;
    if (canal === 'whatsapp') {
      const apiKey = await getYCloudKey(proyecto);
      if (apiKey && proyecto.ycloud_phone_number) {
        sent = plantilla
          ? await sendYCloudTemplate(visitor_id, {
              name: plantilla.name, language: plantilla.language, valores: plantilla.valores,
            }, apiKey, proyecto.ycloud_phone_number)
          : await sendYCloud(visitor_id, contenido, apiKey, proyecto.ycloud_phone_number);
      }
    }

    // Save to message history
    await supabase.from('conversaciones_chat').insert({
      proyecto_id, visitor_id, canal, role: 'assistant', content: contenido,
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

// ── Notas internas de la conversación ──────────────────────────────────────
// Append-only: cada nota es una fila con autor y hora. Ver 012_conversacion_notas.sql.

// GET /api/conversations/:id/notas
router.get('/:id/notas', async (req, res) => {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const proyecto = await ownedProject(proyecto_id, req.user.id);
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    const { data, error } = await supabase
      .from('conversacion_notas')
      .select('id, contenido, autor_id, autor_nombre, created_at')
      .eq('proyecto_id', proyecto_id)
      .eq('visitor_id', visitor_id)
      .eq('canal', canal)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    res.json({ notas: data || [] });
  } catch (err) {
    console.error('[conversations] notas list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/conversations/:id/notas  body: { contenido: string }
router.post('/:id/notas', async (req, res) => {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const contenido = (req.body?.contenido || '').trim();
    if (!contenido) return res.status(400).json({ error: 'El contenido de la nota no puede estar vacío' });

    const proyecto = await ownedProject(proyecto_id, req.user.id);
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    const autorNombre = req.user.user_metadata?.full_name
      || req.user.user_metadata?.name
      || req.user.email
      || 'Agente';

    const { data, error } = await supabase
      .from('conversacion_notas')
      .insert({
        proyecto_id, visitor_id, canal,
        autor_id: req.user.id,
        autor_nombre: autorNombre,
        contenido,
      })
      .select('id, contenido, autor_id, autor_nombre, created_at')
      .single();
    if (error) throw error;

    res.json({ nota: data });
  } catch (err) {
    console.error('[conversations] nota create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Plantillas disponibles para el composer ────────────────────────────────
// Une dos cosas que NO son intercambiables:
//   · HSM  → plantillas aprobadas por Meta. Se pueden enviar SIEMPRE, también fuera de
//            la ventana de 24h. Vienen de YCloud con la key del proyecto (server-side).
//   · rápida → respuestas predefinidas locales (lead_templates). Texto normal, así que
//            SOLO se pueden enviar dentro de la ventana de 24h.
const HSM_CACHE = new Map();          // proyecto_id → { ts, items }
const HSM_CACHE_TTL = 10 * 60 * 1000; // 10 min

async function fetchPlantillasHsm(proyecto) {
  if (!proyecto.ycloud_waba_id) return [];
  const cached = HSM_CACHE.get(proyecto.id);
  if (cached && Date.now() - cached.ts < HSM_CACHE_TTL) return cached.items;

  const apiKey = await getYCloudKey(proyecto);
  if (!apiKey) return [];

  const ycRes = await fetch(
    `https://api.ycloud.com/v2/whatsapp/templates?wabaId=${encodeURIComponent(proyecto.ycloud_waba_id)}&limit=100`,
    { headers: { 'X-API-Key': apiKey } }
  );
  if (!ycRes.ok) return cached?.items || [];
  const data = await ycRes.json();

  const items = (data.items || [])
    .filter(t => String(t.status).toUpperCase() === 'APPROVED')
    .map(t => {
      const body = (t.components || []).find(c => String(c.type).toUpperCase() === 'BODY');
      const texto = body?.text || '';
      // Variables posicionales {{1}}, {{2}}… en orden de aparición, sin repetidos
      const variables = [...new Set((texto.match(/\{\{\d+\}\}/g) || []))]
        .map(v => parseInt(v.replace(/\D/g, ''), 10))
        .sort((a, b) => a - b);
      return {
        id: `hsm:${t.name}:${t.language}`,
        tipo: 'hsm',
        nombre: t.name,
        contenido: texto,
        variables,
        wa_template_name: t.name,
        wa_language: t.language,
      };
    });

  HSM_CACHE.set(proyecto.id, { ts: Date.now(), items });
  return items;
}

// GET /api/conversations/:id/plantillas
router.get('/:id/plantillas', async (req, res) => {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const proyecto = await ownedProject(proyecto_id, req.user.id);
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    // Las HSM solo aplican a WhatsApp; en web/telegram únicamente respuestas rápidas.
    const [hsm, rapidasRes] = await Promise.all([
      canal === 'whatsapp'
        ? fetchPlantillasHsm(proyecto).catch(() => [])
        : Promise.resolve([]),
      supabase
        .from('lead_templates')
        .select('id, name, content, category')
        .eq('user_id', req.user.id)
        .order('name')
        .then(r => r, () => ({ data: [] })),
    ]);

    const rapidas = (rapidasRes.data || []).map(t => ({
      id: `rapida:${t.id}`,
      tipo: 'rapida',
      nombre: t.name,
      contenido: t.content,
      variables: [],
      categoria: t.category || 'general',
    }));

    res.json({ plantillas: [...hsm, ...rapidas], hsm_disponibles: hsm.length });
  } catch (err) {
    console.error('[conversations] plantillas error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
