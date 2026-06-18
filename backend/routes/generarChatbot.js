import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../server.js';

const router = express.Router();

// POST /api/generar-chatbot
router.post('/', async (req, res) => {
  try {
    const { proyecto_id } = req.body;
    if (!proyecto_id) return res.status(400).json({ error: 'proyecto_id required' });

    const { data: proyecto, error } = await supabase.from('proyectos').select('*').eq('id', proyecto_id).single();
    if (error || !proyecto) return res.status(404).json({ error: 'Proyecto not found' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

    const anthropic = new Anthropic({ apiKey });
    const meta = proyecto.metadata_scrapeado || {};
    // Use up to 6000 chars of content (multi-page scrape stored here)
    const contenido = (proyecto.contenido_scrapeado || '').slice(0, 6000);

    const pagesCrawled = meta.pages_crawled?.length > 1
      ? `Páginas analizadas: ${meta.pages_crawled.join(', ')}`
      : `Página analizada: ${proyecto.url_origen}`;

    await supabase.from('proyectos').update({ estado: 'generando' }).eq('id', proyecto_id);

    const prompt = `Analiza el siguiente sitio web y genera la configuración para un chatbot de atención al cliente y captación de leads.

URL principal: ${proyecto.url_origen}
${pagesCrawled}
Título: ${meta.title || ''}
Descripción: ${meta.description || ''}
Tipo de negocio: ${meta.tiene_ecommerce ? `E-commerce (${meta.plataforma_ecommerce || 'tienda online'})` : 'Negocio de servicios/productos'}
Idioma: ${meta.language || 'es'}

Contenido extraído del sitio (múltiples páginas):
${contenido || '(Sin contenido disponible)'}

Genera una configuración JSON con exactamente estos campos:

{
  "nombre_negocio": "nombre real del negocio tal como aparece en el sitio",
  "descripcion": "descripción breve del negocio en 1-2 frases",
  "welcome_message": "mensaje de bienvenida natural y atractivo que invite a interactuar (ej: '¡Hola! 👋 Soy el asistente de X. ¿Te ayudo a encontrar lo que necesitas?')",
  "knowledge_base": "CONTEXTO COMPLETO del negocio para el chatbot. Incluye: qué hace el negocio, productos/servicios con precios si los hay, propuesta de valor diferencial, proceso de compra o contratación, horarios/ubicación/zona de servicio, políticas de devolución/garantía, FAQs más habituales. Escríbelo como un briefing detallado que el chatbot pueda usar directamente.",
  "lead_capture_strategy": "instrucciones concretas para captar leads de forma natural. Basado en el tipo de negocio, indica: 1) qué datos pedir (nombre, email, teléfono), 2) en qué momento de la conversación (ej: cuando el usuario pregunta por presupuesto, cuando muestra interés en un servicio, cuando hace 2 preguntas sobre lo mismo), 3) cómo preguntar de forma no intrusiva. Máximo 150 palabras.",
  "telefono": "número de teléfono si aparece, null si no",
  "email": "email de contacto si aparece, null si no",
  "direccion": "dirección física si aparece, null si no"
}

Reglas importantes:
- El campo knowledge_base debe ser extenso (mínimo 300 palabras) y realmente útil para responder preguntas de clientes
- Si el contenido es de e-commerce, incluye información sobre el proceso de pedido, envíos, devoluciones
- El welcome_message debe usar el nombre real del negocio
- lead_capture_strategy debe ser específica para este tipo de negocio, no genérica
- Responde SOLO con el JSON válido, sin markdown, sin explicaciones`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0]?.text || '{}';
    const cleanRaw = raw.replace(/```json?/g, '').replace(/```/g, '').trim();
    const chatbotConfig = JSON.parse(cleanRaw);

    // Build system prompt for chatbot responses
    const leadInstruction = chatbotConfig.lead_capture_strategy
      ? `\n\nESTRATEGIA DE CAPTACIÓN DE LEADS:\n${chatbotConfig.lead_capture_strategy}`
      : '';

    const systemPrompt = `Eres el asistente virtual de "${chatbotConfig.nombre_negocio}".
Responde de forma amable, clara y concisa. Máximo 4-5 frases salvo que sean listas de productos.
Responde siempre en el idioma del usuario.

INFORMACIÓN DEL NEGOCIO:
${chatbotConfig.knowledge_base}

CONTACTO:
${chatbotConfig.telefono ? `- Teléfono: ${chatbotConfig.telefono}` : ''}
${chatbotConfig.email ? `- Email: ${chatbotConfig.email}` : ''}
- Web: ${proyecto.url_origen}
${leadInstruction}`;

    await supabase.from('proyectos').update({
      chatbot_config: chatbotConfig,
      system_prompt: systemPrompt,
      estado: 'activo',
    }).eq('id', proyecto_id);

    res.json({ ok: true, chatbot_config: chatbotConfig });
  } catch (err) {
    await supabase.from('proyectos').update({ estado: 'activo' }).eq('id', req.body.proyecto_id).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

export default router;
