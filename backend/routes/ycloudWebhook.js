import express from 'express';
import { supabase } from '../server.js';
import {
  buildTools,
  buildSystemPrompt,
  runAgentLoop,
  markdownToWhatsApp,
  loadHistory,
  loadExistingLead,
  createAnthropicClient,
} from '../lib/agentCore.js';
import { loadProjectTools } from '../lib/actionsService.js';
import {
  loadCustomerHistory,
  recordCustomerMessage,
  resolveCustomerIdentity,
} from '../lib/customerIdentityService.js';
const router = express.Router();

// POST /api/ycloud/webhook — WhatsApp inbound messages from YCloud
router.post('/webhook', async (req, res) => {
  // Always respond 200 quickly so YCloud doesn't retry
  res.json({ ok: true });

  try {
    const body = req.body;

    // ── Status updates (delivery receipts) ────────────────────────────────
    if (body.type === 'whatsapp.message.updated') {
      const msg = body.whatsappMessage;
      if (msg?.id && msg?.status) {
        const statusMap = { sent: 'enviado', delivered: 'entregado', read: 'leido', failed: 'error' };
        await supabase.from('mensajes_wa')
          .update({ estado: statusMap[msg.status] || msg.status })
          .eq('wamid', msg.id)
          .then(null, () => {});
      }
      return;
    }

    // ── Only process inbound messages (text or audio/voice) ──────────────
    if (body.type !== 'whatsapp.inbound_message.received') return;

    const inbound = body.whatsappInboundMessage;
    if (!inbound || inbound.type !== 'text' || !inbound.text?.body) return;

    const fromNumber = inbound.from;   // customer phone
    const toNumber   = inbound.to;     // business phone (our number)
    const textoCliente = inbound.text.body;
    const wamid = inbound.id;

    // ── Deduplication ─────────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('mensajes_wa').select('id').eq('wamid', wamid).limit(1);
    if (existing?.length > 0) {
      console.log('[ycloud] Duplicate wamid:', wamid);
      return;
    }

    // ── Find project by phone number ──────────────────────────────────────
    const { data: proyectos } = await supabase
      .from('proyectos').select('*').eq('ycloud_phone_number', toNumber).limit(1);
    if (!proyectos?.length) return;
    const proyecto = proyectos[0];

    // Only reply for active projects
    if (proyecto.estado !== 'pro_activo' && proyecto.estado !== 'activo') return;

    // ── Get YCloud API key ────────────────────────────────────────────────
    let YCLOUD_API_KEY = proyecto.ycloud_api_key || process.env.YCLOUD_API_KEY;
    if (!YCLOUD_API_KEY) {
      const { data: cfg } = await supabase
        .from('config_plataforma').select('ycloud_api_key').eq('clave', 'plataforma').single();
      YCLOUD_API_KEY = cfg?.ycloud_api_key;
    }
    if (!YCLOUD_API_KEY) {
      console.warn('[ycloud] No API key available for project', proyecto.id);
      return;
    }

    // ── Save inbound message ──────────────────────────────────────────────
    const { data: mensajeRecord } = await supabase.from('mensajes_wa').insert({
      proyecto_id: proyecto.id,
      from_number: fromNumber,
      to_number: toNumber,
      mensaje: textoCliente,
      wamid,
      estado: 'recibido',
    }).select().single().then(null, () => ({ data: null }));

    await supabase.from('conversaciones_chat').insert({
      proyecto_id: proyecto.id,
      visitor_id: fromNumber,
      canal: 'whatsapp',
      role: 'user',
      content: textoCliente,
    }).then(null, () => {});

    const customerContext = await resolveCustomerIdentity(supabase, {
      proyecto,
      channel: 'whatsapp',
      threadId: fromNumber,
      legacyVisitorId: fromNumber,
      identities: [
        { identity_type: 'whatsapp_number', identity_value: fromNumber, confidence: 'high', verified: true, source_channel: 'whatsapp' },
        { identity_type: 'phone', identity_value: fromNumber, confidence: 'high', verified: true, source_channel: 'whatsapp' },
      ],
      traits: { phone: fromNumber },
      metadata: { to_number: toNumber, wamid },
    }).catch(err => {
      console.warn('[identity] whatsapp resolve failed:', err.message);
      return null;
    });

    await recordCustomerMessage(supabase, {
      proyectoId: proyecto.id,
      customerId: customerContext?.customer?.id,
      conversationId: customerContext?.conversation?.id,
      channel: 'whatsapp',
      role: 'user',
      content: textoCliente,
      providerMessageId: wamid,
      legacyMessageId: mensajeRecord?.id,
      metadata: { from_number: fromNumber, to_number: toNumber },
    });

    // Keep conversaciones metadata up to date (inbox feature)
    supabase.from('conversaciones').upsert({
      proyecto_id: proyecto.id, visitor_id: fromNumber, canal: 'whatsapp',
      last_message_at: new Date().toISOString(),
    }, { onConflict: 'proyecto_id,visitor_id,canal' }).then(null, () => {});

    // ── Per-conversation human takeover (inbox feature) ───────────────────
    const { data: convTakeover } = await supabase
      .from('conversaciones')
      .select('human_takeover')
      .eq('proyecto_id', proyecto.id)
      .eq('visitor_id', fromNumber)
      .eq('canal', 'whatsapp')
      .maybeSingle()
      .then(r => r, () => ({ data: null }));
    if (convTakeover?.human_takeover === true) {
      // Update last_message_at and skip AI — human agent handles this conversation
      supabase.from('conversaciones')
        .update({ last_message_at: new Date().toISOString() })
        .eq('proyecto_id', proyecto.id).eq('visitor_id', fromNumber).eq('canal', 'whatsapp')
        .then(null, () => {});
      return;
    }

    // ── Human agent mode ──────────────────────────────────────────────────
    if (proyecto.modo_atencion === 'humano') return;

    // ── Message limit ─────────────────────────────────────────────────────
    const mensajesMes = proyecto.mensajes_mes || 0;
    const limiteMensajes = proyecto.limite_mensajes || 200;
    if (mensajesMes >= limiteMensajes) {
      await sendYCloud(fromNumber, 'Lo sentimos, hemos alcanzado el límite de mensajes este mes.', YCLOUD_API_KEY, toNumber);
      return;
    }

    // ── Load history, lead and action tools ──────────────────────────────
    const [legacyHistory, unifiedHistory, existingLead, { enabledNames: actionTools, configs: toolConfigs }] = await Promise.all([
      loadHistory(proyecto.id, fromNumber, textoCliente),
      loadCustomerHistory(supabase, customerContext?.customer?.id, textoCliente),
      loadExistingLead(proyecto.id, fromNumber),
      loadProjectTools(supabase, proyecto.id),
    ]);
    const history = unifiedHistory.length ? unifiedHistory : legacyHistory;

    // Auto-populate phone in lead if not present
    const leadWithPhone = existingLead
      ? { ...existingLead, telefono: existingLead.telefono || fromNumber }
      : null;

    // ── Build agent inputs ────────────────────────────────────────────────
    const config = proyecto.chatbot_config || {};
    const ecommerce = proyecto.ecommerce_config;
    const hasEcommerce = !!(ecommerce?.enabled && ecommerce?.platform && ecommerce.platform !== 'otro');

    const systemPrompt = buildSystemPrompt(proyecto, config, leadWithPhone, 'whatsapp', customerContext);
    const tools = buildTools(hasEcommerce, ecommerce?.platform, actionTools);
    const toolContext = {
      proyecto,
      vid: fromNumber,
      canal: 'whatsapp',
      config,
      existingLead: leadWithPhone,
      toolConfigs,
      customer: customerContext?.customer,
    };

    // ── Run Claude agentic loop ───────────────────────────────────────────
    const anthropic = createAnthropicClient();
    const replyMarkdown = await runAgentLoop(
      anthropic,
      { system: systemPrompt, tools, messages: [...history, { role: 'user', content: textoCliente }] },
      toolContext,
    );

    // Convert Markdown → WhatsApp-safe text
    const respuestaIA = markdownToWhatsApp(replyMarkdown);

    // ── Save and send ─────────────────────────────────────────────────────
    await supabase.from('conversaciones_chat').insert({
      proyecto_id: proyecto.id,
      visitor_id: fromNumber,
      canal: 'whatsapp',
      role: 'assistant',
      content: respuestaIA,
    }).then(null, () => {});

    await recordCustomerMessage(supabase, {
      proyectoId: proyecto.id,
      customerId: customerContext?.customer?.id,
      conversationId: customerContext?.conversation?.id,
      channel: 'whatsapp',
      role: 'assistant',
      content: respuestaIA,
      metadata: { to_number: fromNumber, from_number: toNumber },
    });

    const sendResult = await sendYCloud(fromNumber, respuestaIA, YCLOUD_API_KEY, toNumber);

    if (mensajeRecord) {
      await supabase.from('mensajes_wa')
        .update({ respuesta: respuestaIA, estado: sendResult.ok ? 'enviado' : 'error' })
        .eq('id', mensajeRecord.id)
        .then(null, () => {});
    }

    await supabase.from('proyectos')
      .update({ mensajes_mes: mensajesMes + 1 })
      .eq('id', proyecto.id)
      .then(null, () => {});

  } catch (err) {
    console.error('[ycloud] Webhook processing error:', err.message);
  }
});

// ── YCloud send helper ─────────────────────────────────────────────────────
async function sendYCloud(to, text, apiKey, fromNumber) {
  try {
    const res = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromNumber, to, type: 'text', text: { body: text } }),
    });
    const data = await res.json();
    if (!res.ok) console.error('[ycloud] sendYCloud error:', data);
    return { ok: res.ok, data };
  } catch (err) {
    console.error('[ycloud] sendYCloud exception:', err.message);
    return { ok: false, error: err.message };
  }
}

export default router;
