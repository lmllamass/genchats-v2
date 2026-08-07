import express from 'express';
import { supabase } from '../server.js';

const router = express.Router();

// Public chatbot endpoint (no auth required, used by embedded widget)
// GET /api/chatbot-public/:proyecto_id/config
router.get('/:proyecto_id/config', async (req, res) => {
  try {
    const { proyecto_id } = req.params;
    const { data: proyecto, error } = await supabase
      .from('proyectos')
      .select('id, nombre, url_origen, chatbot_config, estado')
      .eq('id', proyecto_id)
      .single();

    if (error || !proyecto) return res.status(404).json({ error: 'Not found' });

    // Only return safe public config
    const config = proyecto.chatbot_config || {};
    res.json({
      nombre_negocio: config.nombre_negocio || proyecto.nombre,
      welcome_message: config.welcome_message || '¡Hola! ¿En qué puedo ayudarte?',
      logo_url: config.logo_url || '',
      color_primario: config.color_primario || '#6366f1',
      color_secundario: config.color_secundario || '#4f46e5',
      estado: proyecto.estado,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chatbot-public/:proyecto_id/message
router.post('/:proyecto_id/message', async (req, res) => {
  try {
    const { proyecto_id } = req.params;
    const { message, visitor_id } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    // Forward to chatbot respond endpoint
    const port = process.env.PORT || 4000;
    // Se propaga la IP del visitante: al reenviar a localhost, el destino veía
    // ::1 para todo el mundo y la guardaba como si fuera la del cliente.
    const ipVisitante = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.socket?.remoteAddress || '';
    const response = await fetch(`http://localhost:${port}/api/chatbot/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ipVisitante ? { 'x-forwarded-for': ipVisitante } : {}),
      },
      body: JSON.stringify({ proyecto_id, message, visitor_id, channel: 'embed' })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chatbot-public/:proyecto_id/messages?visitor_id=X&after=ISO_TIMESTAMP
// Used by the widget to poll for messages delivered asynchronously (e.g. an
// n8n action whose real answer arrives seconds after the tool call returns).
router.get('/:proyecto_id/messages', async (req, res) => {
  try {
    const { proyecto_id } = req.params;
    const { visitor_id, after } = req.query;
    if (!visitor_id) return res.status(400).json({ error: 'visitor_id required' });

    let query = supabase
      .from('conversaciones_chat')
      .select('role, content, created_at')
      .eq('proyecto_id', proyecto_id)
      .eq('visitor_id', visitor_id)
      .order('created_at', { ascending: true });
    if (after) query = query.gt('created_at', after);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ messages: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chatbot-public/:proyecto_id/async-reply
// Called by n8n (Actions Engine) to deliver a response that couldn't be
// returned synchronously to the tool call — e.g. FADECOM_Reservas_v1 replying
// to a web-chat visitor (no phone number, so it can't send via WhatsApp/YCloud).
// Auth: shared secret (N8N_WEBHOOK_TOKEN), same one used for the actions webhook.
router.post('/:proyecto_id/async-reply', async (req, res) => {
  try {
    const { proyecto_id } = req.params;
    const { visitor_id, mensaje, token } = req.body;
    const expected = process.env.N8N_WEBHOOK_TOKEN;
    if (expected && token !== expected) return res.status(401).json({ error: 'invalid token' });
    if (!visitor_id || !mensaje) return res.status(400).json({ error: 'visitor_id and mensaje required' });

    const { error } = await supabase.from('conversaciones_chat').insert({
      proyecto_id, visitor_id, canal: 'embed', role: 'assistant', content: mensaje,
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
