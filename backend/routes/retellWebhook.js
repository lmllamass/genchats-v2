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

const FAREWELL_RE = /\b(hasta luego|adi[oó]s|chao|bye|goodbye|hasta pronto|hasta la pr[oó]xima|buenas noches|que tenga[s]? buen)\b/i;

function buildPhoneSystemPrompt(proyecto, config, existingLead, customerContext) {
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

  return `Eres el asistente de voz de "${config.nombre_negocio || proyecto.nombre}".
Esta es una llamada telefónica real. Habla de forma natural y concisa.

FORMATO (Voz / Teléfono):
- Máximo 2-3 frases cortas por respuesta.
- Sin Markdown, asteriscos, corchetes, emojis ni viñetas.
- No menciones URLs ni emails (ofrece enviarlos por WhatsApp o email si los piden).
- Responde siempre en el idioma del cliente.

INFORMACIÓN DEL NEGOCIO:
${config.knowledge_base || config.descripcion || 'Sin información adicional.'}

CONTACTO:
${config.telefono ? `- Teléfono: ${config.telefono}` : ''}
${config.email ? `- Email: ${config.email}` : ''}
- Web: ${proyecto.url_origen || ''}
${ecommerceNote}${leadContext}${buildCustomerMemoryPrompt(customerContext)}`;
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

        // Send greeting immediately — don't wait for response_required
        // (begin_message="" doesn't persist via Retell API, so we initiate proactively)
        const greeting = cfg.saludo_telefono
          || cfg.saludo
          || `Hola, gracias por llamar a ${cfg.nombre_negocio || proj.nombre}. ¿En qué puedo ayudarte?`;

        ws.send(JSON.stringify({
          response_type: 'response',
          response_id: 1,
          content: greeting,
          content_complete: true,
        }));
        console.log(`📞 Retell greeting sent — proyecto ${projectId}`);

        resolveState({ proyecto: proj, config: cfg });
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

        const { proyecto, config } = state;
        const vid = callId || `retell_${projectId}_${Date.now()}`;
        const messages = transcriptToMessages(msg.transcript || []);

        // Skip if transcript is empty (greeting already sent on call_details)
        if (messages.length === 0) return;

        const [existingLead, unifiedHistory] = await Promise.all([
          loadExistingLead(projectId, vid),
          loadCustomerHistory(supabase, customerContext?.customer?.id, messages[messages.length - 1]?.content),
        ]);
        const ecommerce = proyecto.ecommerce_config;
        const hasEcommerce = !!(ecommerce?.enabled && ecommerce?.platform && ecommerce.platform !== 'otro');
        const tools = buildTools(hasEcommerce, ecommerce?.platform, config.enabled_action_tools || []);
        const system = buildPhoneSystemPrompt(proyecto, config, existingLead, customerContext);
        const agentMessages = unifiedHistory.length ? [...unifiedHistory, messages[messages.length - 1]] : messages;

        let reply = 'Lo siento, no pude procesar tu consulta. ¿Puedes repetirlo?';
        try {
          reply = await runAgentLoop(
            anthropic,
            { system, tools, messages: agentMessages },
            { proyecto, vid, canal: 'phone', config, existingLead, customer: customerContext?.customer },
            4,
          );
        } catch (err) {
          console.error(`Retell agentLoop error (${projectId}):`, err.message);
        }

        // Persist last user message + assistant reply
        const lastUser = [...messages].reverse().find(m => m.role === 'user');
        if (lastUser) {
          await supabase.from('conversaciones_chat').insert([
            { proyecto_id: projectId, visitor_id: vid, role: 'user',      content: lastUser.content },
            { proyecto_id: projectId, visitor_id: vid, role: 'assistant', content: reply },
          ]).then(({ error }) => { if (error) console.warn('Retell chat save error:', error.message); });

          await recordCustomerMessage(supabase, {
            proyectoId: projectId,
            customerId: customerContext?.customer?.id,
            conversationId: customerContext?.conversation?.id,
            channel: 'phone',
            role: 'user',
            content: lastUser.content,
            metadata: { call_id: callId },
          });
          await recordCustomerMessage(supabase, {
            proyectoId: projectId,
            customerId: customerContext?.customer?.id,
            conversationId: customerContext?.conversation?.id,
            channel: 'phone',
            role: 'assistant',
            content: reply,
            metadata: { call_id: callId },
          });
        }

        const endCall = FAREWELL_RE.test(reply);
        ws.send(JSON.stringify({
          response_type: 'response',
          response_id: msg.response_id,
          content: reply,
          content_complete: true,
          ...(endCall && { end_call: true }),
        }));

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
