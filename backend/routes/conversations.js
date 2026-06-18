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

    res.json({
      messages: messages || [],
      human_takeover: st?.human_takeover || false,
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

// POST /api/conversations/:id/message  body: { text: string }
router.post('/:id/message', async (req, res) => {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text required' });

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

    // Send via YCloud for WhatsApp
    let sent = false;
    if (canal === 'whatsapp') {
      const apiKey = await getYCloudKey(proyecto);
      if (apiKey && proyecto.ycloud_phone_number) {
        sent = await sendYCloud(visitor_id, text, apiKey, proyecto.ycloud_phone_number);
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

export default router;
