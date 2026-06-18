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
    const response = await fetch(`http://localhost:${port}/api/chatbot/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proyecto_id, message, visitor_id, channel: 'embed' })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
