import express from 'express';
import { supabase } from '../server.js';

const router = express.Router();

function replaceVars(text, lead, proyectoNombre) {
  const fecha = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return text
    .replace(/\{\{nombre\}\}/gi, lead.nombre || '')
    .replace(/\{\{proyecto\}\}/gi, proyectoNombre || '')
    .replace(/\{\{telefono\}\}/gi, lead.telefono || '')
    .replace(/\{\{fecha\}\}/gi, fecha);
}

async function ownedLead(leadId, userId) {
  const { data: lead } = await supabase
    .from('leads')
    .select('*, proyectos(id, nombre, user_id, ycloud_api_key, ycloud_phone_number)')
    .eq('id', leadId)
    .single();
  if (!lead || lead.proyectos?.user_id !== userId) return null;
  return lead;
}

// ── Templates (must come BEFORE /:id routes) ──────────────────────────────

// GET /api/leads/templates
router.get('/templates', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('lead_templates')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ templates: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/templates
router.post('/templates', async (req, res) => {
  try {
    const { name, content, category = 'general' } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'name and content required' });
    const { data, error } = await supabase
      .from('lead_templates')
      .insert({ user_id: req.user.id, name, content, category })
      .select()
      .single();
    if (error) throw error;
    res.json({ template: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/leads/templates/:id
router.delete('/templates/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('lead_templates')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Leads list ─────────────────────────────────────────────────────────────

// GET /api/leads?projectId=X&page=1&limit=50&status=&search=
router.get('/', async (req, res) => {
  try {
    const { projectId, page = '1', limit = '50', status, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let pQuery = supabase.from('proyectos').select('id, nombre, user_id').eq('user_id', req.user.id);
    if (projectId) pQuery = pQuery.eq('id', projectId);
    const { data: proyectos } = await pQuery;
    if (!proyectos?.length) return res.json({ leads: [], total: 0 });

    const proyectoIds = proyectos.map(p => p.id);
    const proyectoMap = Object.fromEntries(proyectos.map(p => [p.id, p]));

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .in('proyecto_id', proyectoIds)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('estado', status);
    if (search) query = query.or(`nombre.ilike.%${search}%,email.ilike.%${search}%,telefono.ilike.%${search}%`);

    const { data: leads, error, count } = await query.range(offset, offset + parseInt(limit) - 1);
    if (error) throw error;

    const result = (leads || []).map(l => ({
      ...l,
      proyecto_nombre: proyectoMap[l.proyecto_id]?.nombre || '',
    }));

    res.json({ leads: result, total: count || 0 });
  } catch (err) {
    console.error('[leads] list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Single lead ────────────────────────────────────────────────────────────

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  try {
    const lead = await ownedLead(req.params.id, req.user.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found or forbidden' });

    const { data: messages } = await supabase
      .from('lead_messages')
      .select('*')
      .eq('lead_id', req.params.id)
      .order('sent_at', { ascending: true });

    res.json({ lead, messages: messages || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/leads/:id
router.patch('/:id', async (req, res) => {
  try {
    const lead = await ownedLead(req.params.id, req.user.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found or forbidden' });

    const allowed = ['estado', 'notas', 'assigned_to', 'tags', 'nombre', 'email', 'telefono', 'empresa'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const { data, error } = await supabase.from('leads').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ lead: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/:id/whatsapp
router.post('/:id/whatsapp', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message required' });

    const lead = await ownedLead(req.params.id, req.user.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found or forbidden' });
    if (!lead.telefono) return res.status(400).json({ error: 'Lead has no phone number' });

    const proyectoNombre = lead.proyectos?.nombre || '';
    const finalMessage = replaceVars(message, lead, proyectoNombre);

    // Get YCloud API key (project first, then global)
    let apiKey = lead.proyectos?.ycloud_api_key;
    if (!apiKey) {
      const { data: cfg } = await supabase.from('config_plataforma').select('ycloud_api_key').eq('clave', 'plataforma').single();
      apiKey = cfg?.ycloud_api_key;
    }
    const fromNumber = lead.proyectos?.ycloud_phone_number;
    if (!apiKey || !fromNumber) return res.status(400).json({ error: 'WhatsApp not configured for this project' });

    // Send via YCloud
    const sendRes = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromNumber, to: lead.telefono, type: 'text', text: { body: finalMessage } }),
    });
    const sendData = await sendRes.json();
    if (!sendRes.ok) return res.status(400).json({ error: sendData.message || 'WhatsApp send failed' });

    // Update lead stats and status
    await supabase.from('leads').update({
      last_contact_at: new Date().toISOString(),
      whatsapp_sent_count: (lead.whatsapp_sent_count || 0) + 1,
      ...(lead.estado === 'nuevo' ? { estado: 'contactado' } : {}),
    }).eq('id', req.params.id);

    // Log sent message
    await supabase.from('lead_messages').insert({
      lead_id: req.params.id,
      message: finalMessage,
      sent_by: req.user.email,
      direction: 'outbound',
    }).then(null, () => {});

    res.json({ ok: true, message: finalMessage });
  } catch (err) {
    console.error('[leads] whatsapp error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
