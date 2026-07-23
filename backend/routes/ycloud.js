import express from 'express';
import { supabase } from '../server.js';

const router = express.Router();

// POST /api/ycloud-config/registrar-webhook — { proyecto_id? }
// Si proyecto_id viene informado Y el proyecto tiene su PROPIA cuenta YCloud (ycloud_api_key
// propia, distinta de la plataforma), el webhook se registra en ESA cuenta — cada WABA/cuenta
// de YCloud tiene sus propios webhooks, así que registrarlo con la key equivocada no sirve de
// nada (el mensaje entrante nunca llega a nuestro backend). Si el proyecto no tiene cuenta
// propia, se usa la global de config_plataforma como hasta ahora.
router.post('/registrar-webhook', async (req, res) => {
  try {
    const { proyecto_id } = req.body || {};
    let apiKey = null;
    let isProjectOwn = false;

    if (proyecto_id) {
      const { data: proyecto } = await supabase
        .from('proyectos').select('ycloud_api_key').eq('id', proyecto_id).single();
      if (proyecto?.ycloud_api_key) {
        apiKey = proyecto.ycloud_api_key;
        isProjectOwn = true;
      }
    }
    if (!apiKey) {
      const { data: cfg } = await supabase.from('config_plataforma').select('ycloud_api_key').eq('clave', 'plataforma').single();
      apiKey = cfg?.ycloud_api_key;
    }
    if (!apiKey) return res.status(400).json({ error: 'YCloud API key not configured' });

    // Siempre usar el dominio real — nunca la IP hardcodeada
    const apiUrl = process.env.API_PUBLIC_URL || 'https://api-v2.genchats.app';
    const webhookUrl = `${apiUrl}/api/ycloud/webhook`;
    const headers = { 'X-API-Key': apiKey, 'Content-Type': 'application/json' };

    // Listamos los webhooks YA existentes en ESTA cuenta (propia del proyecto o global) —
    // evita duplicados y no depende de guardar un ID por proyecto en ningún sitio.
    const listRes = await fetch('https://api.ycloud.com/v2/webhookEndpoints', { headers });
    if (listRes.ok) {
      const list = await listRes.json();
      const existing = (list.items || []).find(w => w.url === webhookUrl);
      if (existing) {
        return res.json({ ok: true, status: 'ya_existia', webhook_id: existing.id, webhook_url: webhookUrl, cuenta: isProjectOwn ? 'proyecto' : 'global' });
      }
    }

    // Crear webhook nuevo en esta cuenta
    const response = await fetch('https://api.ycloud.com/v2/webhookEndpoints', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: webhookUrl,
        description: 'genchats webhook',
        enabledEvents: ['whatsapp.inbound_message.received', 'whatsapp.message.updated']
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(400).json({ error: data.message || 'YCloud error' });

    if (!isProjectOwn) {
      await supabase.from('config_plataforma').update({
        ycloud_webhook_id: data.id,
        ycloud_webhook_url: webhookUrl
      }).eq('clave', 'plataforma');
    }

    res.json({ ok: true, status: 'creado', webhook_id: data.id, webhook_url: webhookUrl, cuenta: isProjectOwn ? 'proyecto' : 'global' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ycloud-config/enviar-mensaje-prueba
router.post('/enviar-mensaje-prueba', async (req, res) => {
  try {
    // Frontend puede enviar { to, mensaje } o { telefono_prueba } — soportamos ambos
    const { proyecto_id, to, mensaje, telefono_prueba } = req.body;
    const destinatario = to || telefono_prueba;
    if (!destinatario) return res.status(400).json({ error: 'Falta el número de teléfono destino' });

    const { data: proyecto } = await supabase
      .from('proyectos')
      .select('ycloud_api_key, ycloud_phone_number, chatbot_config')
      .eq('id', proyecto_id)
      .single();

    // Fallback: si el proyecto no tiene API key propia, usar la global de config_plataforma
    let apiKey = proyecto?.ycloud_api_key;
    if (!apiKey) {
      const { data: cfg } = await supabase
        .from('config_plataforma').select('ycloud_api_key').eq('clave', 'plataforma').single();
      apiKey = cfg?.ycloud_api_key;
    }
    if (!apiKey) return res.status(400).json({ error: 'YCloud API key no configurada (ni en proyecto ni en config global)' });
    if (!proyecto?.ycloud_phone_number) return res.status(400).json({ error: 'Número de WhatsApp del proyecto no configurado' });

    const textoMensaje = mensaje ||
      `¡Hola! Soy el chatbot de ${proyecto.chatbot_config?.nombre_negocio || 'tu negocio'} en GenChat IA. ¡Todo funciona correctamente! 🎉`;

    const response = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: proyecto.ycloud_phone_number,
        to: destinatario,
        type: 'text',
        text: { body: textoMensaje }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[ycloud] enviar-mensaje-prueba error:', data);
      return res.status(400).json({ error: data.message || data.detail || 'Error enviando mensaje' });
    }
    res.json({ ok: true, wamid: data.id, message_id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ycloud-config/activar
router.post('/activar', async (req, res) => {
  try {
    const { proyecto_id } = req.body;
    await supabase.from('proyectos').update({ whatsapp_activo: true }).eq('id', proyecto_id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
