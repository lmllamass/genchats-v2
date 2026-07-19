import express from 'express';
import { supabase } from '../server.js';

const router = express.Router();

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const NAME_RX = /^[a-z0-9_]{1,512}$/;

async function ownedProject(proyecto_id, userId) {
  const { data } = await supabase
    .from('proyectos')
    .select('id, nombre, user_id, ycloud_api_key, ycloud_waba_id')
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

// GET /api/whatsapp-templates?proyecto_id=X — list Meta templates for the tenant's WABA
router.get('/', async (req, res) => {
  try {
    const { proyecto_id } = req.query;
    if (!proyecto_id) return res.status(400).json({ error: 'proyecto_id requerido' });

    const proyecto = await ownedProject(proyecto_id, req.user.id);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    if (!proyecto.ycloud_waba_id) return res.status(400).json({ error: 'Este proyecto no tiene una cuenta de WhatsApp Business (WABA) configurada.' });

    const apiKey = await getYCloudKey(proyecto);
    if (!apiKey) return res.status(400).json({ error: 'YCloud API key no configurada' });

    const ycRes = await fetch(`https://api.ycloud.com/v2/whatsapp/templates?wabaId=${encodeURIComponent(proyecto.ycloud_waba_id)}&limit=100`, {
      headers: { 'X-API-Key': apiKey },
    });
    const data = await ycRes.json();
    if (!ycRes.ok) return res.status(ycRes.status).json({ error: data?.error?.message || data?.message || 'Error de YCloud' });

    res.json({ templates: data.items || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp-templates — create a new Meta template via YCloud
router.post('/', async (req, res) => {
  try {
    const { proyecto_id, name, language, category, bodyText, bodyExample, footerText, buttons } = req.body;
    if (!proyecto_id) return res.status(400).json({ error: 'proyecto_id requerido' });
    if (!name || !NAME_RX.test(name)) return res.status(400).json({ error: 'Nombre inválido: solo minúsculas, números y guion bajo (sin espacios ni acentos)' });
    if (!language) return res.status(400).json({ error: 'language requerido (ej. es, en_US)' });
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: `category debe ser una de: ${CATEGORIES.join(', ')}` });
    if (!bodyText || !bodyText.trim()) return res.status(400).json({ error: 'bodyText requerido' });

    const proyecto = await ownedProject(proyecto_id, req.user.id);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    if (!proyecto.ycloud_waba_id) return res.status(400).json({ error: 'Este proyecto no tiene una cuenta de WhatsApp Business (WABA) configurada.' });

    const apiKey = await getYCloudKey(proyecto);
    if (!apiKey) return res.status(400).json({ error: 'YCloud API key no configurada' });

    const bodyComponent = { type: 'BODY', text: bodyText };
    const varCount = (bodyText.match(/\{\{\d+\}\}/g) || []).length;
    if (varCount > 0) {
      const examples = Array.isArray(bodyExample) ? bodyExample.filter(Boolean) : [];
      if (examples.length < varCount) {
        return res.status(400).json({ error: `El texto usa ${varCount} variable(s) ({{1}}, {{2}}...) — debes dar un valor de ejemplo para cada una.` });
      }
      bodyComponent.example = { body_text: [examples.slice(0, varCount)] };
    }

    const components = [bodyComponent];
    if (footerText && footerText.trim()) {
      components.push({ type: 'FOOTER', text: footerText.trim() });
    }
    if (Array.isArray(buttons) && buttons.length) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.filter(b => b?.text?.trim()).slice(0, 3).map(b => ({
          type: b.type === 'URL' ? 'URL' : b.type === 'PHONE_NUMBER' ? 'PHONE_NUMBER' : 'QUICK_REPLY',
          text: b.text.trim(),
          ...(b.type === 'URL' ? { url: b.url } : {}),
          ...(b.type === 'PHONE_NUMBER' ? { phone_number: b.phone_number } : {}),
        })),
      });
    }

    const ycRes = await fetch('https://api.ycloud.com/v2/whatsapp/templates', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wabaId: proyecto.ycloud_waba_id,
        name,
        language,
        category,
        components,
      }),
    });
    const data = await ycRes.json();
    if (!ycRes.ok) return res.status(ycRes.status).json({ error: data?.error?.message || data?.message || 'Error de YCloud al crear la plantilla' });

    res.json({ ok: true, template: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/whatsapp-templates/:name?proyecto_id=X&language=es — delete a template
router.delete('/:name', async (req, res) => {
  try {
    const { proyecto_id, language } = req.query;
    const { name } = req.params;
    if (!proyecto_id) return res.status(400).json({ error: 'proyecto_id requerido' });

    const proyecto = await ownedProject(proyecto_id, req.user.id);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    if (!proyecto.ycloud_waba_id) return res.status(400).json({ error: 'Este proyecto no tiene una cuenta de WhatsApp Business (WABA) configurada.' });

    const apiKey = await getYCloudKey(proyecto);
    if (!apiKey) return res.status(400).json({ error: 'YCloud API key no configurada' });

    const path = language
      ? `/v2/whatsapp/templates/${encodeURIComponent(proyecto.ycloud_waba_id)}/${encodeURIComponent(name)}/${encodeURIComponent(language)}`
      : `/v2/whatsapp/templates/${encodeURIComponent(proyecto.ycloud_waba_id)}/${encodeURIComponent(name)}`;

    const ycRes = await fetch(`https://api.ycloud.com${path}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': apiKey },
    });
    if (!ycRes.ok && ycRes.status !== 404) {
      const data = await ycRes.json().catch(() => ({}));
      return res.status(ycRes.status).json({ error: data?.error?.message || data?.message || 'Error de YCloud al borrar la plantilla' });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
