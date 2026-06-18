import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function cleanScrapedContent(markdown, mainUrl) {
  if (!markdown) return "";
  let mainDomain = "";
  try { mainDomain = new URL(mainUrl).hostname.replace(/^www\./, ''); } catch {}
  let lines = markdown.split('\n');
  lines = lines.filter(line => {
    if (/https?:\/\//.test(line)) {
      if (mainDomain && line.includes(mainDomain)) return true;
      return false;
    }
    return true;
  });
  lines = lines.filter(line => !(line.trim().startsWith('[') && /\]\(https?:\/\//.test(line)));
  let text = lines.join('\n');
  text = text.replace(/\\{2,}/g, '');
  text = text.replace(/\\n/g, '\n');
  text = text.replace(/\\t/g, ' ');
  text = text.replace(/\*\*/g, '');
  text = text.replace(/\*/g, '');
  text = text.replace(/^#+\s*/gm, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim().slice(0, 4000);
  return text;
}

async function generateKnowledgeBase(cleanedContent, metadata) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return cleanedContent;

  const titulo = metadata?.title || '';
  const desc = metadata?.description || '';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Eres un experto organizando información de negocios para chatbots de atención al cliente.

Con este contenido scrapeado de la web de un negocio:
Título: ${titulo}
Descripción: ${desc}
Contenido: ${cleanedContent}

Genera un documento de base de conocimiento COMPLETO y bien estructurado para un chatbot.
El documento debe incluir TODA la información disponible organizada en secciones claras:

- Nombre del negocio
- Descripción general
- Servicios / Productos (con detalles y precios si están disponibles)
- Horarios de atención
- Ubicación / Dirección
- Datos de contacto (teléfono, email, web)
- Preguntas frecuentes (genera 5-8 basadas en el contenido)
- Cualquier otra info relevante

Si algún dato no está disponible, omítelo. No inventes información.
Escribe en español. Formato texto plano, legible y organizado.`
      }],
      max_tokens: 1500,
      temperature: 0.3
    })
  });

  const aiData = await response.json();
  return aiData.choices?.[0]?.message?.content || cleanedContent;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { proyecto_id, chatbot_config } = await req.json();
    if (!proyecto_id) return Response.json({ error: 'proyecto_id is required' }, { status: 400 });

    const proyecto = await base44.entities.Proyecto.get(proyecto_id);
    const rawMd = proyecto?.contenido_scrapeado || "";
    const mainUrl = proyecto?.url_origen || "";
    const cleanedContent = cleanScrapedContent(rawMd, mainUrl);

    // Generate structured knowledge base with AI
    let knowledgeBase = cleanedContent;
    try {
      knowledgeBase = await generateKnowledgeBase(cleanedContent, proyecto?.metadata_scrapeado);
    } catch (e) {
      console.log('AI knowledge base generation failed, using raw content:', e.message);
    }

    // Extract contact info
    let telefono = chatbot_config?.telefono || "";
    let email = chatbot_config?.email || "";
    const lines = cleanedContent.split('\n');
    for (const line of lines) {
      if (!telefono && /(\+?\d[\d\s\-]{7,})/.test(line)) {
        telefono = line.match(/(\+?\d[\d\s\-]{7,})/)[1].trim();
      }
      if (!email && /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/.test(line)) {
        email = line.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/)[1];
      }
    }

    const nombreNegocio = chatbot_config?.nombre_negocio || proyecto?.metadata_scrapeado?.title || proyecto?.nombre || "Mi Negocio";
    const descripcion = chatbot_config?.descripcion || proyecto?.metadata_scrapeado?.description || "";
    const welcomeMsg = chatbot_config?.welcome_message || `¡Hola! 👋 Soy el asistente virtual de ${nombreNegocio}. ¿En qué puedo ayudarte?`;

    const finalConfig = {
      nombre_negocio: nombreNegocio,
      descripcion,
      logo_url: chatbot_config?.logo_url || proyecto?.metadata_scrapeado?.favicon || "",
      color_primario: chatbot_config?.color_primario || "#6366f1",
      color_secundario: chatbot_config?.color_secundario || "#8b5cf6",
      welcome_message: welcomeMsg,
      knowledge_base: knowledgeBase,
      telefono,
      email,
      direccion: chatbot_config?.direccion || "",
      notification_email: chatbot_config?.notification_email || "",
    };

    await base44.entities.Proyecto.update(proyecto_id, {
      chatbot_config: finalConfig,
      estado: 'activo',
    });

    return Response.json({ chatbot_config: finalConfig });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});