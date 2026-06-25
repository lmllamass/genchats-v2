/**
 * agentCore.js — Shared Claude agentic loop for web chatbot, WhatsApp and Telegram.
 * Extracted from chatbotRespond.js so all channels use identical intelligence.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import { supabase } from '../server.js';
import { queryEcommerce, formatProducts } from './ecommerceConnectors.js';
import { callActionWebhook } from './actionsService.js';
import { buildCustomerMemoryPrompt, updateCustomerFromContact } from './customerIdentityService.js';

// ── Retry helper (handles 529 Overloaded) ──────────────────────────────────
export async function callWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isOverloaded = err.status === 529 || err.message?.includes('overloaded');
      if (isOverloaded && i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

// ── Action tool definitions (n8n via webhook) ──────────────────────────────
const ACTION_TOOL_DEFS = {
  concertar_cita: {
    name: 'concertar_cita',
    description: 'Concertar una cita, reserva o visita para el cliente. Úsalo cuando el usuario quiera reservar, programar una cita o acordar una fecha.',
    input_schema: {
      type: 'object',
      properties: {
        nombre:          { type: 'string', description: 'Nombre completo del cliente' },
        telefono:        { type: 'string', description: 'Teléfono de contacto' },
        email:           { type: 'string', description: 'Email del cliente' },
        fecha_preferida: { type: 'string', description: 'Fecha y hora preferida (ej: "mañana a las 10h", "15 de julio por la tarde")' },
        motivo:          { type: 'string', description: 'Servicio o motivo de la cita' },
      },
      required: [],
    },
  },
  capturar_pedido: {
    name: 'capturar_pedido',
    description: 'Registrar un pedido del cliente. Úsalo cuando el usuario quiera hacer un pedido o compra.',
    input_schema: {
      type: 'object',
      properties: {
        nombre:    { type: 'string', description: 'Nombre del cliente' },
        telefono:  { type: 'string', description: 'Teléfono de contacto' },
        email:     { type: 'string', description: 'Email del cliente' },
        productos: { type: 'string', description: 'Descripción de los productos o servicios pedidos, cantidades y referencias' },
        direccion: { type: 'string', description: 'Dirección de entrega (si aplica)' },
        notas:     { type: 'string', description: 'Notas adicionales del pedido' },
      },
      required: [],
    },
  },
  consultar_stock: {
    name: 'consultar_stock',
    description: 'Consultar disponibilidad o stock de un producto específico en tiempo real.',
    input_schema: {
      type: 'object',
      properties: {
        referencia: { type: 'string', description: 'Referencia o código del producto' },
        nombre:     { type: 'string', description: 'Nombre o descripción del producto' },
      },
      required: [],
    },
  },
  custom: {
    name: 'custom',
    description: 'Ejecutar una acción personalizada configurada para este negocio.',
    input_schema: {
      type: 'object',
      properties: {
        accion:  { type: 'string', description: 'Nombre de la acción a ejecutar' },
        datos:   { type: 'object', description: 'Datos necesarios para la acción' },
      },
      required: [],
    },
  },
};

// ── Tool definitions ───────────────────────────────────────────────────────
export function buildTools(hasEcommerce, ecommercePlatform, enabledActionTools = []) {
  const tools = [];

  if (hasEcommerce) {
    tools.push({
      name: 'buscar_productos',
      description: `Busca productos en la tienda (${ecommercePlatform}). Úsalo cuando el cliente pregunte por productos, precios, disponibilidad, stock o referencias específicas.`,
      input_schema: {
        type: 'object',
        properties: {
          consulta: {
            type: 'string',
            description: 'Término de búsqueda: nombre del producto, referencia, tipo o características.',
          },
          categoria: {
            type: 'string',
            description: 'Categoría a filtrar (opcional). Deja vacío si no se especifica categoría.',
          },
        },
        required: [],
      },
    });

    tools.push({
      name: 'ver_categorias',
      description: 'Obtiene todas las categorías de productos disponibles en la tienda. Úsalo cuando el cliente pregunte qué tipos de productos hay o quiera explorar el catálogo.',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    });
  }

  tools.push({
    name: 'guardar_contacto',
    description: 'OBLIGATORIO: Llama a esta herramienta DE INMEDIATO en cuanto el usuario mencione su nombre, email o teléfono en cualquier mensaje — aunque sea de pasada. No esperes a tener todos los datos. También inclúyela si el usuario describe su interés o necesidad. NO la llames si el usuario no ha facilitado ningún dato personal.',
    input_schema: {
      type: 'object',
      properties: {
        nombre:   { type: 'string', description: 'Nombre completo del cliente (si lo mencionó)' },
        email:    { type: 'string', description: 'Email del cliente (si lo mencionó)' },
        telefono: { type: 'string', description: 'Teléfono del cliente (si lo mencionó)' },
        empresa:  { type: 'string', description: 'Empresa u organización del cliente (si la mencionó)' },
        interes:  { type: 'string', description: 'Resumen de lo que busca o le interesa, en 1-2 frases' },
      },
      required: [],
    },
  });

  // n8n action tools — only injected when enabled for this project
  for (const toolName of enabledActionTools) {
    if (ACTION_TOOL_DEFS[toolName]) tools.push(ACTION_TOOL_DEFS[toolName]);
  }

  return tools;
}

// ── Tool executor ──────────────────────────────────────────────────────────
export async function executeTool(toolName, toolInput, { proyecto, vid, canal, config, existingLead, customer, toolConfigs }) {
  switch (toolName) {

    case 'buscar_productos': {
      const result = await queryEcommerce(proyecto, { ...toolInput, accion: 'products' });
      return formatProducts(result);
    }

    case 'ver_categorias': {
      const result = await queryEcommerce(proyecto, { accion: 'categories' });
      return formatProducts(result);
    }

    case 'guardar_contacto': {
      const payload = {
        proyecto_id: proyecto.id,
        visitor_id: vid,
        canal,
        ultimo_mensaje: new Date().toISOString(),
      };
      if (toolInput.nombre)   payload.nombre   = toolInput.nombre;
      if (toolInput.email)    payload.email    = toolInput.email;
      if (toolInput.telefono) payload.telefono = toolInput.telefono;
      if (toolInput.empresa)  payload.empresa  = toolInput.empresa;
      if (toolInput.interes)  payload.notas    = toolInput.interes;

      const hasData = !!(toolInput.nombre || toolInput.email || toolInput.telefono);

      if (existingLead) {
        await supabase.from('leads').update(payload).eq('id', existingLead.id);
      } else {
        await supabase.from('leads').insert(payload);

        // Notify via Resend if email configured and we have real contact data
        if (hasData && config.notification_email) {
          try {
            // RESEND_API_KEY: env var primero, fallback a config_plataforma en Supabase
            let resendKey = process.env.RESEND_API_KEY;
            if (!resendKey) {
              const { data: cfg } = await supabase
                .from('config_plataforma').select('resend_api_key').eq('clave', 'plataforma').single();
              resendKey = cfg?.resend_api_key;
            }

            if (resendKey) {
              // Cargar historial de conversación para incluirlo en el email
              const { data: historial } = await supabase
                .from('conversaciones_chat')
                .select('role, content')
                .eq('proyecto_id', proyecto.id)
                .eq('visitor_id', vid)
                .order('created_at', { ascending: true })
                .limit(30);

              // Formatear transcripción como HTML
              const transcriptHtml = historial && historial.length > 0
                ? historial.map(msg => {
                    const isUser = msg.role === 'user';
                    const bg     = isUser ? '#eff6ff' : '#f9fafb';
                    const border = isUser ? '#3b82f6' : '#d1d5db';
                    const label  = isUser ? '👤 Cliente' : '🤖 Chatbot';
                    const color  = isUser ? '#1e40af'   : '#374151';
                    const safe   = (msg.content || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                    return `<div style="margin:6px 0;padding:10px 14px;border-radius:8px;background:${bg};border-left:3px solid ${border}">
                      <div style="font-weight:700;font-size:11px;color:${color};margin-bottom:4px">${label}</div>
                      <div style="font-size:13px;color:#374151;white-space:pre-wrap">${safe}</div>
                    </div>`;
                  }).join('')
                : '<p style="color:#9ca3af;font-size:13px;margin:0">Sin historial disponible.</p>';

              const resend    = new Resend(resendKey);
              const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@genchats.app';
              const subject   = toolInput.nombre
                ? `🎯 Nuevo lead — ${toolInput.nombre} (${config.nombre_negocio})`
                : `🎯 Nuevo lead en ${config.nombre_negocio}`;

              await resend.emails.send({
                from: `GenChat IA <${fromEmail}>`,
                to: config.notification_email,
                subject,
                html: `
                  <div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#ffffff">

                    <!-- Header -->
                    <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:22px 26px;border-radius:12px;margin-bottom:24px">
                      <h2 style="color:white;margin:0;font-size:20px">🎯 Nuevo contacto capturado</h2>
                      <p style="color:rgba(255,255,255,0.75);margin:5px 0 0;font-size:13px">
                        ${config.nombre_negocio} &nbsp;·&nbsp; Canal: <strong style="color:white">${canal}</strong>
                      </p>
                    </div>

                    <!-- Datos del lead -->
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px 20px;margin-bottom:22px">
                      <h3 style="margin:0 0 12px;color:#166534;font-size:14px;text-transform:uppercase;letter-spacing:.05em">📋 Datos del contacto</h3>
                      ${toolInput.nombre   ? `<p style="margin:5px 0;font-size:14px"><strong>Nombre:</strong> ${toolInput.nombre}</p>` : ''}
                      ${toolInput.email    ? `<p style="margin:5px 0;font-size:14px"><strong>Email:</strong> <a href="mailto:${toolInput.email}" style="color:#2563eb">${toolInput.email}</a></p>` : ''}
                      ${toolInput.telefono ? `<p style="margin:5px 0;font-size:14px"><strong>Teléfono:</strong> <a href="tel:${toolInput.telefono}" style="color:#2563eb">${toolInput.telefono}</a></p>` : ''}
                      ${toolInput.empresa  ? `<p style="margin:5px 0;font-size:14px"><strong>Empresa:</strong> ${toolInput.empresa}</p>` : ''}
                      ${toolInput.interes  ? `<p style="margin:5px 0;font-size:14px"><strong>Interés:</strong> ${toolInput.interes}</p>` : ''}
                    </div>

                    <!-- Transcripción -->
                    <div style="margin-bottom:24px">
                      <h3 style="margin:0 0 12px;color:#1f2937;font-size:14px;text-transform:uppercase;letter-spacing:.05em">💬 Conversación completa</h3>
                      ${transcriptHtml}
                    </div>

                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
                    <p style="color:#9ca3af;font-size:12px;margin:0">
                      Notificación automática de <a href="https://genchats.app" style="color:#7c3aed;text-decoration:none">GenChat IA</a>
                    </p>
                  </div>`,
              });

              console.log(`📧 Email de lead enviado a ${config.notification_email}`);
            } else {
              console.warn('Lead notification skipped: RESEND_API_KEY not configured');
            }
          } catch (e) {
            console.error('Lead notification error:', e.message);
          }
        }
      }
      await updateCustomerFromContact(supabase, {
        customer,
        proyectoId: proyecto.id,
        channel: canal,
        contact: toolInput,
      });
      return { guardado: true, mensaje: 'Datos de contacto registrados correctamente.' };
    }

    default: {
      // Delegate to n8n webhook if this is a registered action tool
      if (Object.prototype.hasOwnProperty.call(ACTION_TOOL_DEFS, toolName)) {
        const toolConfig = toolConfigs?.[toolName] || {};
        const result = await callActionWebhook(proyecto.id, toolName, toolInput, toolConfig);
        return result.mensaje || result.message || (result.ok ? 'Acción completada correctamente.' : 'No se pudo completar la acción.');
      }
      throw new Error(`Tool desconocido: ${toolName}`);
    }
  }
}

// ── Agentic loop ───────────────────────────────────────────────────────────
/**
 * @param {object} hooks - Streaming hooks (opt-in, sólo voz):
 *   onDelta(text)   -> se llama con cada fragmento de texto del modelo (para TTS en streaming)
 *   onToolStart()   -> se llama una vez al empezar a ejecutar herramientas sin texto previo
 *                      (para enviar una muletilla de espera al cliente)
 * Si no se pasa onDelta, se usa el camino clásico sin streaming (web/WhatsApp/Telegram).
 */
export async function runAgentLoop(anthropic, { system, tools, messages }, toolContext, maxIter = 4, hooks = {}) {
  const { onDelta, onToolStart } = hooks;
  const streaming = typeof onDelta === 'function';
  let currentMessages = [...messages];
  let fillerFired = false;

  for (let iter = 0; iter < maxIter; iter++) {
    let response;
    let sawText = false;

    if (streaming) {
      const stream = anthropic.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system,
        tools,
        messages: currentMessages,
      });
      stream.on('text', (delta) => { sawText = true; onDelta(delta); });
      response = await stream.finalMessage();
    } else {
      response = await callWithRetry(() =>
        anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system,
          tools,
          messages: currentMessages,
        })
      );
    }

    // Final answer
    if (response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.text || 'Lo siento, no pude procesar tu consulta.';
    }

    // Va a ejecutar herramientas: si el modelo no dijo nada antes, lanza una muletilla
    if (streaming && onToolStart && !sawText && !fillerFired) {
      fillerFired = true;
      try { onToolStart(); } catch { /* noop */ }
    }

    // Execute all tool calls in parallel
    const toolUses = response.content.filter(b => b.type === 'tool_use');
    const toolResults = await Promise.all(
      toolUses.map(async (tu) => {
        try {
          const result = await executeTool(tu.name, tu.input, toolContext);
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: typeof result === 'string' ? result : JSON.stringify(result),
          };
        } catch (err) {
          console.error(`Tool ${tu.name} error:`, err.message);
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: `Error al ejecutar ${tu.name}: ${err.message}`,
            is_error: true,
          };
        }
      })
    );

    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: response.content },
      { role: 'user',      content: toolResults },
    ];
  }

  return 'Lo siento, no pude completar la consulta. Por favor, inténtalo de nuevo.';
}

// ── System prompt builder ──────────────────────────────────────────────────
/**
 * Builds a channel-aware system prompt.
 * @param {object} proyecto  - Full project row
 * @param {object} config    - proyecto.chatbot_config
 * @param {object|null} existingLead - Lead row for this visitor (or null)
 * @param {'web'|'whatsapp'|'telegram'} canal
 */
export function buildSystemPrompt(proyecto, config, existingLead, canal = 'web', customerContext = null) {
  const ecommerce = proyecto.ecommerce_config;
  const hasEcommerce = !!(ecommerce?.enabled && ecommerce?.platform && ecommerce.platform !== 'otro');

  // Channel-specific format instructions
  const formatInstructions = canal === 'whatsapp'
    ? `FORMATO (WhatsApp):
- Texto plano. Negrita con *asterisco simple*.
- NO uses corchetes [texto](url). Las URLs van directamente en el texto.
- OBLIGATORIO: cuando el resultado de la herramienta incluya URLs de productos (líneas con 👉), CÓPIALAS LITERALMENTE en tu respuesta — el cliente necesita esos enlaces para ver la ficha del producto. No las omitas ni las resumas.
- Si la búsqueda no devuelve productos, incluye el enlace al catálogo que aparezca en el resultado.
- Máximo 4-5 frases por respuesta, salvo listas de productos.`
    : canal === 'telegram'
    ? `FORMATO (Telegram):
- Texto plano. Las URLs van directamente en el texto (Telegram las convierte en enlaces automáticamente).
- OBLIGATORIO: cuando el resultado de la herramienta incluya URLs de productos (líneas con 👉), CÓPIALAS LITERALMENTE en tu respuesta — el cliente necesita esos enlaces para ver la ficha. No las omitas.
- Si la búsqueda no devuelve productos, incluye el enlace al catálogo que aparezca en el resultado.
- Máximo 4-5 frases por respuesta, salvo listas de productos.`
    : `FORMATO (Web):
- Usa Markdown estándar.
- Cuando el resultado de la herramienta incluya URLs de productos (líneas con 👉), preséntálas como [🔗 Ver producto](url) — no las omitas.
- Si no se encuentran productos, muestra el enlace al catálogo si aparece en el resultado.`;

  // Ecommerce note
  const ecommerceNote = hasEcommerce
    ? `\n\nTIENDA ONLINE (${ecommerce.platform}): Usa la herramienta buscar_productos para consultar el catálogo real antes de responder preguntas sobre productos, precios o disponibilidad.`
    : '';

  // Lead context
  let leadContext = '';
  if (existingLead?.nombre || existingLead?.email || existingLead?.telefono) {
    leadContext = '\n\nDATOS CONOCIDOS DEL CLIENTE (NO vuelvas a pedirlos):';
    if (existingLead.nombre)   leadContext += `\n- Nombre: ${existingLead.nombre}`;
    if (existingLead.email)    leadContext += `\n- Email: ${existingLead.email}`;
    if (existingLead.telefono) leadContext += `\n- Teléfono: ${existingLead.telefono}`;
    if (existingLead.empresa)  leadContext += `\n- Empresa: ${existingLead.empresa}`;
    // For WhatsApp we always know the phone number
    if (canal === 'whatsapp' && !existingLead.telefono) {
      leadContext += `\n(El teléfono del cliente es el número desde el que escribe)`;
    }
    leadContext += '\n\nSi el cliente facilita datos adicionales (empresa, otro email, teléfono), llama a guardar_contacto para actualizarlos.';
  } else {
    const strategy = config.lead_capture_strategy;
    if (strategy) {
      leadContext = `\n\nREGLA OBLIGATORIA DE CAPTACIÓN DE LEADS:\n${strategy}\n⚡ Si el usuario menciona su nombre, email o teléfono, llama a guardar_contacto DE INMEDIATO en ese mismo turno.`;
    } else {
      leadContext = `\n\nREGLA OBLIGATORIA DE CAPTACIÓN DE LEADS:
⚡ Si el usuario menciona su nombre, email o teléfono en CUALQUIER mensaje (aunque sea de pasada), llama a guardar_contacto INMEDIATAMENTE — en el mismo turno, antes de responder.
📝 Si el usuario muestra interés concreto (pregunta precios, pide presupuesto, menciona un proyecto), pregunta de forma natural: "¿Me puedes dejar tu nombre y cómo contactarte para hacerte seguimiento?"
🎯 Objetivo: registrar el mayor número de leads posible.`;
    }
  }

  const omnichannelContext = buildCustomerMemoryPrompt(customerContext);

  return `Eres el asistente virtual de "${config.nombre_negocio}".
Responde de forma amable, clara y concisa. Máximo 4-5 frases salvo que sean listas de productos.
Responde siempre en el idioma del usuario.

INFORMACIÓN DEL NEGOCIO:
${config.knowledge_base || config.descripcion || 'Sin información adicional.'}

CONTACTO:
${config.telefono ? `- Teléfono: ${config.telefono}` : ''}
${config.email ? `- Email: ${config.email}` : ''}
- Web: ${proyecto.url_origen || ''}

${formatInstructions}${ecommerceNote}${leadContext}${omnichannelContext}`;
}

// ── WhatsApp text formatter ────────────────────────────────────────────────
/**
 * Converts Markdown to WhatsApp-compatible plain text.
 * WhatsApp uses *bold*, _italic_, ~strikethrough~, ```mono```.
 * Does NOT support [text](url) links — URLs must be plain.
 */
export function markdownToWhatsApp(text) {
  return text
    // **bold** → *bold*
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    // __bold__ → *bold*
    .replace(/__(.+?)__/g, '*$1*')
    // [label](url) → label: url  (URLs son auto-linked en WhatsApp como texto plano)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1: $2')
    // # Header → remove hashes
    .replace(/^#{1,6}\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '———')
    .trim();
}

// ── Shared conversation history loader ────────────────────────────────────
export async function loadHistory(proyecto_id, visitor_id, currentMessage) {
  const { data: historial } = await supabase
    .from('conversaciones_chat')
    .select('role,content')
    .eq('proyecto_id', proyecto_id)
    .eq('visitor_id', visitor_id)
    .order('created_at', { ascending: true })
    .limit(30);

  let history = [];
  if (historial) {
    for (let i = 0; i < historial.length; i++) {
      // Skip the message just inserted (last user message)
      if (i === historial.length - 1 && historial[i].role === 'user' && historial[i].content === currentMessage) continue;
      history.push({ role: historial[i].role, content: historial[i].content });
    }
    if (history.length > 20) history = history.slice(-20);
  }
  return history;
}

// ── Shared lead loader ────────────────────────────────────────────────────
export async function loadExistingLead(proyecto_id, visitor_id) {
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('proyecto_id', proyecto_id)
    .eq('visitor_id', visitor_id)
    .limit(1);
  return leads?.[0] || null;
}

// ── Anthropic client factory ───────────────────────────────────────────────
export function createAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  return new Anthropic({ apiKey });
}
