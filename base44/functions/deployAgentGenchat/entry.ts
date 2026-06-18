import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acceso denegado: solo administradores' }, { status: 403 });
    }

    const { proyecto_id } = await req.json();
    if (!proyecto_id) {
      return Response.json({ error: 'proyecto_id es requerido' }, { status: 400 });
    }

    const proyecto = await base44.asServiceRole.entities.Proyecto.get(proyecto_id);
    if (!proyecto) {
      return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const config = proyecto.chatbot_config || {};
    const ecommerce = proyecto.ecommerce_config || {};
    const hasEcommerce = ecommerce.enabled && ecommerce.platform;

    const nombreNegocio = config.nombre_negocio || proyecto.nombre || 'Negocio';
    const agentName = `chatbot_${proyecto.id}`;

    // Build ecommerce instructions
    let ecommerceBlock = '';
    if (hasEcommerce) {
      ecommerceBlock = `
- Esta es una TIENDA ONLINE (${ecommerce.platform}). Puedes consultar productos, precios, stock y categorías mediante la herramienta queryProducts.
- Cuando muestres productos, incluye nombre, precio y disponibilidad.
- Si el usuario pregunta por categorías, lista las disponibles.
- Formatea la información de productos de forma clara y atractiva.`;
      if (ecommerce.platform === 'ferreteria1') {
        ecommerceBlock += `
- Esta tienda usa ferreteria1.app con acceso a catálogo propio + catálogo global Daterium (600.000+ referencias).
- Los productos con source "daterium" NO tienen precio ni stock; indica al cliente que puede pedir presupuesto.
- Los productos con source "local" SÍ tienen precio y stock reales.`;
      }
      if (ecommerce.platform === 'googlesheets') {
        ecommerceBlock += `
- El inventario se carga desde una Google Sheet pública.
- Si un producto tiene "url", incluye siempre el enlace para que el cliente pueda verlo.`;
      }
    }

    const contactInfo = [
      config.telefono ? `Teléfono: ${config.telefono}` : null,
      config.email ? `Email: ${config.email}` : null,
      config.direccion ? `Dirección: ${config.direccion}` : null,
      proyecto.url_origen ? `Web: ${proyecto.url_origen}` : null,
    ].filter(Boolean).join('\n');

    const waLink = config.telefono
      ? `https://wa.me/${config.telefono.replace(/[^0-9+]/g, '').replace(/^0+/, '34')}`
      : '';

    const welcomeMessage = config.welcome_message || `¡Hola! 👋 Soy el asistente virtual de ${nombreNegocio}. ¿En qué puedo ayudarte?`;

    const systemPrompt = `Eres el asistente virtual de "${nombreNegocio}".
Tu objetivo es responder preguntas de los clientes de forma amable, clara y concisa.

REGLAS:
- Responde SOLO con información que esté en la base de conocimiento o en los datos de productos proporcionados.
- Si no tienes la información, di amablemente que no la tienes y sugiere contactar directamente.
- Sé breve pero completo (máx 4-5 frases, más si son listas de productos).
- Usa un tono profesional pero cercano.
- Responde en el idioma del usuario.

DATOS DE CONTACTO:
${contactInfo}
${waLink ? `WhatsApp: ${waLink}` : ''}

CAPTACIÓN DE DATOS:
- En tu PRIMER o SEGUNDO mensaje, preséntate y pregunta "¿Con quién tengo el gusto?" o "¿Cómo te llamas?".
- Una vez tengas el nombre, busca el momento oportuno para pedir email o teléfono.
- Si el usuario pregunta por productos/servicios, aprovecha para decir "Te puedo enviar los detalles por email, ¿cuál es?".
- NO esperes a que el usuario ofrezca sus datos espontáneamente. Pídelos activamente pero con educación.
- Si ya tienes nombre + contacto, no vuelvas a pedir.

CUANDO NO ENCUENTRES PRODUCTOS:
- Muestra un mensaje amable indicando que no encontraste ese producto pero que pueden consultarlo directamente.
${proyecto.url_origen ? `- Incluye: "🌐 [Visita nuestra web](${proyecto.url_origen})"` : ''}
${config.telefono ? `- Incluye: "📞 Llámanos: ${config.telefono}"` : ''}
${waLink ? `- Incluye enlace de WhatsApp con consulta del usuario.` : ''}
${ecommerceBlock}

BASE DE CONOCIMIENTO:
${config.knowledge_base || config.descripcion || 'Sin información disponible.'}`;

    // Auto-update the project's agent_name
    await base44.asServiceRole.entities.Proyecto.update(proyecto_id, {
      agent_name: agentName,
    });

    // Build markdown document
    const markdown = `# Configuración del Agente: ${agentName}

## Datos del negocio
- **Negocio:** ${nombreNegocio}
- **URL:** ${proyecto.url_origen}
- **Email:** ${config.email || 'N/A'}
- **Teléfono:** ${config.telefono || 'N/A'}
- **WhatsApp:** ${config.whatsapp_numero || 'N/A'}
- **Telegram:** ${proyecto.telegram_username ? '@' + proyecto.telegram_username : 'N/A'}
- **E-commerce:** ${hasEcommerce ? ecommerce.platform : 'No'}

## Mensaje de bienvenida
${welcomeMessage}

## System Prompt
\`\`\`
${systemPrompt}
\`\`\`

## Pasos de activación
1. Crear nuevo agente en Base44 Superagent con nombre: \`${agentName}\`
2. Pegar el System Prompt en las instrucciones del agente
3. Pegar el Mensaje de bienvenida
4. Conectar WhatsApp (si el cliente lo solicitó)
5. Conectar Telegram (si el cliente lo solicitó)
6. Actualizar agent_name en la entidad Proyecto → ✅ Ya actualizado automáticamente
7. Verificar canales activos en el Editor del cliente
8. Enviar email de bienvenida al cliente
`;

    const agent = {
      name: agentName,
      negocio: nombreNegocio,
      url_origen: proyecto.url_origen,
      email: config.email || '',
      telefono: config.telefono || '',
      ecommerce: hasEcommerce ? ecommerce.platform : false,
      whatsapp_numero: config.whatsapp_numero || proyecto.ycloud_phone_number || '',
      telegram_username: proyecto.telegram_username || '',
      system_prompt: systemPrompt,
      welcome_message: welcomeMessage,
    };

    return Response.json({
      ok: true,
      agent,
      markdown,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});