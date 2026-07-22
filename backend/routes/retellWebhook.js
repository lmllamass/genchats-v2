import { WebSocketServer } from 'ws';
import { supabase } from '../server.js';
import {
  buildTools,
  runAgentLoop,
  loadExistingLead,
  createAnthropicClient,
} from '../lib/agentCore.js';
import {
  buildCustomerMemoryPrompt,
  loadCustomerHistory,
  recordCustomerMessage,
  resolveCustomerIdentity,
} from '../lib/customerIdentityService.js';
import { loadProjectTools } from '../lib/actionsService.js';

const FAREWELL_RE = /\b(hasta luego|adi[oó]s|chao|bye|goodbye|hasta pronto|hasta la pr[oó]xima|buenas noches|que tenga[s]? buen)\b/i;

// Muletillas de espera (se locuta una mientras el agente consulta una herramienta)
const FILLERS = [
  'Un momento, estoy localizando tu petición.',
  'Enseguida te respondo.',
  'Un segundo, que lo compruebo.',
  'Dame un momento, por favor.',
  'Ahora mismo lo miro.',
];

function buildPhoneSystemPrompt(proyecto, config, existingLead, customerContext, callerPhone = null) {
  const ecommerce = proyecto.ecommerce_config;
  const hasEcommerce = !!(ecommerce?.enabled && ecommerce?.platform && ecommerce.platform !== 'otro');

  const ecommerceNote = hasEcommerce
    ? `\n\nTIENDA ONLINE (${ecommerce.platform}): Puedes consultar catálogo y stock usando las herramientas disponibles.`
    : '';

  let leadContext;
  if (existingLead?.nombre || existingLead?.email || existingLead?.telefono) {
    leadContext = '\n\nDATOS CONOCIDOS DEL CLIENTE (NO vuelvas a pedirlos):';
    if (existingLead.nombre)   leadContext += `\n- Nombre: ${existingLead.nombre}`;
    if (existingLead.email)    leadContext += `\n- Email: ${existingLead.email}`;
    if (existingLead.telefono) leadContext += `\n- Teléfono: ${existingLead.telefono}`;
    leadContext += '\n\nSi el cliente facilita datos adicionales, llama a guardar_contacto para actualizarlos.';
  } else {
    leadContext = '\n\nREGLA OBLIGATORIA: Si el cliente menciona su nombre, email o teléfono, llama a guardar_contacto DE INMEDIATO.';
  }

  const whatsappNote = (callerPhone
    ? `\n\nWHATSAPP: Ya conoces el número del cliente porque te está llamando desde él (${callerPhone}). Si pide que le mandes información, un enlace, un resumen o cualquier dato por escrito, usa DIRECTAMENTE la herramienta enviar_whatsapp con to="${callerPhone}" — NO le preguntes su número de teléfono, ya lo tienes. Solo pide un número distinto si el cliente dice explícitamente que quiere recibirlo en otro número.`
    : '\n\nWHATSAPP: Si el cliente quiere recibir información por escrito, pídele su número de WhatsApp y usa la herramienta enviar_whatsapp.')
    + '\nSi el cliente te DICTA un número de teléfono en voz alta (el suyo propio o uno distinto), repítelo tú en voz alta dígito a dígito para confirmarlo ANTES de usarlo en enviar_whatsapp ("Confirmo, es el 6-0-9-2-1-1-0-4-0, ¿correcto?") — los números hablados son fáciles de transcribir mal. No lo uses hasta que el cliente confirme que es correcto.'
    + '\nIMPORTANTE: el texto que escribas en el parámetro "mensaje" de enviar_whatsapp NO tiene las restricciones del habla — no lo resumas ni omitas enlaces. Cuando el resultado de buscar_productos incluya URLs de producto (líneas con 👉), CÓPIALAS LITERALMENTE dentro de ese mensaje de WhatsApp; el cliente las necesita para ver la ficha. Las reglas de "sin webs, sin URLs, sin corchetes" del apartado FORMATO son solo para lo que dices en voz durante la llamada.';

  return `Eres el asistente de voz de "${config.nombre_negocio || proyecto.nombre}".
Esta es una llamada telefónica real. Habla de forma natural, cercana y concisa.

FORMATO (Voz / Teléfono):
- Máximo 2-3 frases cortas por respuesta. Una idea por frase.
- Sin Markdown, asteriscos, corchetes, emojis ni viñetas.
- Pronuncia con acento español neutro, vocales claras. No uses siglas sin deletrearlas.
- No ofrezcas webs ni emails por iniciativa propia. Si el cliente los pide, dilos despacio; para URLs largas, mejor ofrécete a enviárselas por WhatsApp.
- Puedes decir números de teléfono despacio si el cliente los pide.
- Responde siempre en el idioma del cliente.
- Si necesitas consultar datos con una herramienta, úsala directamente sin anunciarlo; el sistema ya avisa al cliente de la espera.

COMPORTAMIENTO:
- Usa SOLO la información del negocio de abajo. Si no sabes algo o no está en esa información, dilo con naturalidad ("no tengo ese dato a mano") y ofrece tomar nota para que les llamen, o conectar con una persona.
- NO inventes precios, plazos, stock, horarios, direcciones ni datos de contacto. Si no constan, no los supongas.
- No prometas nada que no puedas confirmar con la información o las herramientas disponibles.
- Si no entiendes al cliente, pide que lo repita de forma concreta ("perdona, ¿puedes repetirme el nombre del producto?").
- Si el cliente se enfada o pide hablar con una persona, ofrece tomar sus datos y que le llamen.
- Sé breve: no recites listas largas; resume y pregunta en qué concretar.

INFORMACIÓN DEL NEGOCIO:
${config.knowledge_base_voz || config.knowledge_base || config.descripcion || 'Sin información adicional.'}

CONTACTO (compártelo sólo si el cliente lo pide):
${config.telefono ? `- Teléfono: ${config.telefono}` : ''}
${config.email ? `- Email: ${config.email}` : ''}
- Web: ${proyecto.url_origen || ''}
${ecommerceNote}${leadContext}${whatsappNote}${buildCustomerMemoryPrompt(customerContext)}`;
}

function transcriptToMessages(transcript) {
  if (!transcript?.length) return [];
  const msgs = transcript
    .map(t => ({
      role: t.role === 'agent' ? 'assistant' : 'user',
      content: (t.content || '').trim(),
    }))
    .filter(m => m.content);

  // Anthropic requires alternating roles starting with 'user'
  // Retell may start with agent (greeting). Drop leading assistant messages.
  while (msgs.length && msgs[0].role === 'assistant') msgs.shift();
  return msgs;
}

export function attachRetellWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const match = req.url?.match(/^\/api\/retell\/llm\/([^/?#]+)/);
    if (!match) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, match[1]);
    });
  });

  wss.on('connection', (ws, _req, projectId) => {
    console.log(`📞 Retell WS connected — proyecto ${projectId}`);

    const anthropic = createAnthropicClient();
    let callId = null;
    let customerContext = null;

    // Promise that resolves to { proyecto, config } once call_details arrives
    let resolveState;
    const stateReady = new Promise(res => { resolveState = res; });

    // Send config event immediately on connect
    ws.send(JSON.stringify({
      response_type: 'config',
      config: { auto_reconnect: true, call_details: true },
    }));

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      // ── call_details: load project ─────────────────────────────────────
      if (msg.interaction_type === 'call_details') {
        callId = msg.call?.call_id || null;
        const callerPhone = msg.call?.from_number
          || msg.call?.from
          || msg.call?.caller_number
          || msg.call?.metadata?.from_number
          || null;
        const businessPhone = msg.call?.to_number
          || msg.call?.to
          || msg.call?.callee_number
          || msg.call?.metadata?.to_number
          || null;

        const { data: proj } = await supabase
          .from('proyectos')
          .select('*')
          .eq('id', projectId)
          .single();

        if (!proj?.retell_activo) {
          ws.close(1008, 'Retell inactive for this project');
          resolveState(null);
          return;
        }

        const cfg = typeof proj.chatbot_config === 'string'
          ? JSON.parse(proj.chatbot_config)
          : (proj.chatbot_config || {});

        // Send greeting FIRST — must not wait on resolveCustomerIdentity (measured ~600ms of
        // sequential DB round trips) nor on response_required. The greeting text doesn't depend
        // on customer identity at all.
        const greeting = cfg.saludo_telefono
          || cfg.saludo
          || `Hola, gracias por llamar a ${cfg.nombre_negocio || proj.nombre}. ¿En qué puedo ayudarte?`;

        ws.send(JSON.stringify({
          response_type: 'response',
          response_id: 0,
          content: greeting,
          content_complete: true,
        }));
        console.log(`📞 Retell greeting sent — proyecto ${projectId}`);

        // Resolve customer identity AFTER the greeting is already on the wire. Subsequent turns
        // await `stateReady` (resolved below), so this still finishes before it's needed.
        customerContext = await resolveCustomerIdentity(supabase, {
          proyecto: proj,
          channel: 'phone',
          threadId: callId || `retell_${projectId}_${Date.now()}`,
          legacyVisitorId: callId || `retell_${projectId}_${Date.now()}`,
          identities: [
            callId && { identity_type: 'retell_call_id', identity_value: callId, confidence: 'medium', source_channel: 'phone' },
            callerPhone && { identity_type: 'retell_phone_number', identity_value: callerPhone, confidence: 'high', verified: true, source_channel: 'phone' },
            callerPhone && { identity_type: 'phone', identity_value: callerPhone, confidence: 'high', verified: true, source_channel: 'phone' },
          ].filter(Boolean),
          traits: { phone: callerPhone },
          metadata: { call_id: callId, from_number: callerPhone, to_number: businessPhone },
        }).catch(err => {
          console.warn('[identity] retell resolve failed:', err.message);
          return null;
        });

        resolveState({ proyecto: proj, config: cfg, callerPhone });
        return;
      }

      // ── ping_pong ──────────────────────────────────────────────────────
      if (msg.interaction_type === 'ping_pong') {
        ws.send(JSON.stringify({ response_type: 'ping_pong', timestamp: msg.timestamp }));
        return;
      }

      // ── response_required / reminder_required ──────────────────────────
      if (msg.interaction_type === 'response_required' || msg.interaction_type === 'reminder_required') {
        const state = await stateReady;
        if (!state) return;

        const { proyecto, config, callerPhone } = state;
        const vid = callId || `retell_${projectId}_${Date.now()}`;
        const messages = transcriptToMessages(msg.transcript || []);

        // Fallback greeting if transcript arrives empty before first user turn
        if (messages.length === 0) {
          const greeting = config.saludo_telefono
            || config.saludo
            || `Hola, gracias por llamar a ${config.nombre_negocio || proyecto.nombre}. ¿En qué puedo ayudarte?`;
          ws.send(JSON.stringify({
            response_type: 'response',
            response_id: msg.response_id,
            content: greeting,
            content_complete: true,
          }));
          return;
        }

        const [existingLead, unifiedHistory, { enabledNames: actionTools, configs: toolConfigs }] = await Promise.all([
          loadExistingLead(projectId, vid),
          loadCustomerHistory(supabase, customerContext?.customer?.id, messages[messages.length - 1]?.content),
          loadProjectTools(supabase, projectId),
        ]);
        const ecommerce = proyecto.ecommerce_config;
        const hasEcommerce = !!(ecommerce?.enabled && ecommerce?.platform && ecommerce.platform !== 'otro');

        // enviar_whatsapp siempre disponible en llamadas de voz
        const enabledTools = [...new Set([...actionTools, 'enviar_whatsapp'])];

        const tools = buildTools(hasEcommerce, ecommerce?.platform, enabledTools);
        const system = buildPhoneSystemPrompt(proyecto, config, existingLead, customerContext, callerPhone);
        // Retell nos da la transcripción COMPLETA de esta llamada en cada turno (gratis, en vivo) —
        // nunca hay que descartarla. `unifiedHistory` solo aporta valor para contexto de OTROS
        // canales/llamadas anteriores; sus propias entradas de esta misma llamada ('[phone] ...',
        // escritas de forma asíncrona tras cada turno) ya están duplicadas en `messages`, así que
        // se excluyen para no repetir contexto ni desplazar turnos reales de la llamada actual.
        const crossChannelHistory = unifiedHistory.filter(m => !m.content.startsWith('[phone]'));
        // Anthropic exige alternancia estricta user/assistant. `messages` (transcript de Retell)
        // siempre empieza en 'user', así que si el historial cruzado también terminara en 'user'
        // (pregunta de otro canal sin respuesta registrada) se descarta esa última entrada.
        while (crossChannelHistory.length && crossChannelHistory[crossChannelHistory.length - 1].role === 'user') {
          crossChannelHistory.pop();
        }
        const agentMessages = crossChannelHistory.length ? [...crossChannelHistory, ...messages] : messages;

        // ── Streaming hacia Retell: enviamos el texto a medida que el modelo lo genera ──
        let streamed = false;
        const sendDelta = (text) => {
          if (!text) return;
          streamed = true;
          ws.send(JSON.stringify({
            response_type: 'response',
            response_id: msg.response_id,
            content: text,
            content_complete: false,
          }));
        };
        // Muletilla de espera mientras se ejecutan herramientas
        const filler = FILLERS[Math.floor(Math.random() * FILLERS.length)];
        const hooks = {
          onDelta: sendDelta,
          onToolStart: () => sendDelta(`${filler} `),
        };

        let reply = '';
        try {
          reply = await runAgentLoop(
            anthropic,
            { system, tools, messages: agentMessages },
            { proyecto, vid, canal: 'phone', config, existingLead, toolConfigs, callerPhone, customer: customerContext?.customer },
            4,
            hooks,
          );
        } catch (err) {
          console.error(`Retell agentLoop error (${projectId}):`, err.message);
        }

        const endCall = FAREWELL_RE.test(reply || '');
        // Cierre del turno: si ya streameamos, sólo marcamos complete; si no, enviamos fallback.
        ws.send(JSON.stringify({
          response_type: 'response',
          response_id: msg.response_id,
          content: streamed ? '' : (reply || 'Perdona, no te he entendido. ¿Puedes repetirlo?'),
          content_complete: true,
          ...(endCall && { end_call: true }),
        }));

        // Persistir DESPUÉS de responder (no bloquea la latencia del turno)
        const lastUser = [...messages].reverse().find(m => m.role === 'user');
        if (lastUser && reply) {
          supabase.from('conversaciones_chat').insert([
            { proyecto_id: projectId, visitor_id: vid, role: 'user',      content: lastUser.content },
            { proyecto_id: projectId, visitor_id: vid, role: 'assistant', content: reply },
          ]).then(({ error }) => { if (error) console.warn('Retell chat save error:', error.message); });

          recordCustomerMessage(supabase, {
            proyectoId: projectId,
            customerId: customerContext?.customer?.id,
            conversationId: customerContext?.conversation?.id,
            channel: 'phone',
            role: 'user',
            content: lastUser.content,
            metadata: { call_id: callId },
          }).catch(() => {});
          recordCustomerMessage(supabase, {
            proyectoId: projectId,
            customerId: customerContext?.customer?.id,
            conversationId: customerContext?.conversation?.id,
            channel: 'phone',
            role: 'assistant',
            content: reply,
            metadata: { call_id: callId },
          }).catch(() => {});
        }

        if (endCall) console.log(`📞 Call ended by agent — proyecto ${projectId}`);
        return;
      }

      // Unhandled events (call_started, call_ended, etc.) are silently ignored
    });

    ws.on('close', () => console.log(`📞 Retell WS closed — proyecto ${projectId}`));
    ws.on('error', (err) => console.error(`Retell WS error (${projectId}):`, err.message));
  });

  console.log('📞 Retell Custom LLM WebSocket handler attached at /api/retell/llm/:projectId');
}
