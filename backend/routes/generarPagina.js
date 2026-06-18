import express from 'express';
import OpenAI from 'openai';
import { supabase } from '../server.js';

const router = express.Router();

// POST /api/generar-pagina
router.post('/', async (req, res) => {
  try {
    const { proyecto_id, plantilla, esquema_color } = req.body;
    if (!proyecto_id) return res.status(400).json({ error: 'proyecto_id required' });

    const { data: proyecto, error } = await supabase.from('proyectos').select('*').eq('id', proyecto_id).single();
    if (error || !proyecto) return res.status(404).json({ error: 'Proyecto not found' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

    const openai = new OpenAI({ apiKey });
    const meta = proyecto.metadata_scrapeado || {};
    const chatbotConfig = proyecto.chatbot_config || {};
    const contenido = (proyecto.contenido_scrapeado || '').slice(0, 3000);

    const plantillaElegida = plantilla || proyecto.plantilla_elegida || 'moderna';
    const colorElegido = esquema_color || proyecto.esquema_color || 'azul_profesional';

    const colorMap = {
      azul_profesional: { primary: '#2563eb', secondary: '#1e40af', bg: '#f8faff' },
      verde_naturaleza: { primary: '#16a34a', secondary: '#15803d', bg: '#f0fdf4' },
      rojo_impacto: { primary: '#dc2626', secondary: '#b91c1c', bg: '#fff5f5' },
      oscuro_premium: { primary: '#6366f1', secondary: '#4f46e5', bg: '#0f0f13' },
      claro_limpio: { primary: '#64748b', secondary: '#475569', bg: '#fafafa' },
      naranja_energia: { primary: '#ea580c', secondary: '#c2410c', bg: '#fff7ed' },
    };
    const colors = colorMap[colorElegido] || colorMap.azul_profesional;

    const prompt = `Genera una landing page HTML completa y profesional para este negocio.

Negocio: ${chatbotConfig.nombre_negocio || proyecto.nombre}
URL origen: ${proyecto.url_origen}
Descripción: ${chatbotConfig.descripcion || meta.description || ''}
Plantilla: ${plantillaElegida}
Color primario: ${colors.primary}
Color secundario: ${colors.secondary}
Contenido del sitio: ${contenido}

REQUISITOS:
- HTML completo con <html>, <head>, <body> y CSS inline
- Diseño ${plantillaElegida} y profesional
- Sección hero con CTA
- Sección de servicios/productos
- Sección de contacto con: ${chatbotConfig.telefono || ''} ${chatbotConfig.email || ''}
- Responsive (mobile-first)
- Color primario: ${colors.primary}
- NO uses imágenes externas (usa gradientes y SVG)
- Incluye schema.org LocalBusiness
- Solo devuelve el HTML, sin explicaciones.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000, temperature: 0.4
    });

    const htmlGenerado = completion.choices[0]?.message?.content || '';

    // Save to project
    await supabase.from('proyectos').update({
      plantilla_elegida: plantillaElegida,
      esquema_color: colorElegido,
      estado: 'activo'
    }).eq('id', proyecto_id);

    res.json({ ok: true, html: htmlGenerado });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
