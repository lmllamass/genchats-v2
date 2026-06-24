import express from 'express';
import { supabase } from '../server.js';
import {
  buildTools,
  buildSystemPrompt,
  runAgentLoop,
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

// POST /api/chatbot/respond
router.post('/respond', async (req, res) => {
  try {
    const { proyecto_id, message, visitor_id, channel } = req.body;
    if (!proyecto_id || !message) {
      return res.status(400).json({ error: 'proyecto_id and message are required' });
    }

    // Load project
    const { data: proyecto, error: pErr } = await supabase
      .from('proyectos').select('*').eq('id', proyecto_id).single();
    if (pErr || !proyecto?.chatbot_config) {
      return res.status(400).json({ error: 'Chatbot not configured' });
    }

    // Rate limiting
    const currentCount = proyecto.mensajes_count || 0;
    const { data: cfgGlobal } = await supabase
      .from('config_global').select('limite_mensajes_mes').eq('clave', 'global').single();
    const globalLimit = cfgGlobal?.limite_mensajes_mes || 500;
    if (currentCount >= globalLimit) {
      return res.json({ reply: 'Has alcanzado tu límite mensual de conversaciones.' });
    }
    await supabase.from('proyectos').update({ mensajes_count: currentCount + 1 }).eq('id', proyecto_id);

    const anthropic = createAnthropicClient();

    const vid   = visitor_id || ('anon_' + Date.now().toString(36));
    const canal = channel || 'web';
    const config = proyecto.chatbot_config || {};
    const ecommerce = proyecto.ecommerce_config;
    const hasEcommerce = !!(ecommerce?.enabled && ecommerce?.platform && ecommerce.platform !== 'otro');
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;

    const customerContext = await resolveCustomerIdentity(supabase, {
      proyecto,
      channel: canal,
      threadId: vid,
      legacyVisitorId: vid,
      identities: [
        { identity_type: 'web_visitor_id', identity_value: vid, confidence: 'medium', source_channel: canal },
        ip && { identity_type: 'ip', identity_value: ip, confidence: 'low', source_channel: canal },
      ].filter(Boolean),
      metadata: { ip },
    }).catch(err => {
      console.warn('[identity] web resolve failed:', err.message);
      return null;
    });

    // Save user message
    try {
      const { data: legacyMsg } = await supabase.from('conversaciones_chat').insert({
        proyecto_id, visitor_id: vid, canal, role: 'user', content: message,
      }).select().single();
      await recordCustomerMessage(supabase, {
        proyectoId: proyecto_id,
        customerId: customerContext?.customer?.id,
        conversationId: customerContext?.conversation?.id,
        channel: canal,
        role: 'user',
        content: message,
        legacyMessageId: legacyMsg?.id,
        metadata: { ip },
      });
    } catch (_) {}

    // Load history, lead and enabled action tools
    const [legacyHistory, unifiedHistory, existingLead, { enabledNames: actionTools, configs: toolConfigs }] = await Promise.all([
      loadHistory(proyecto_id, vid, message),
      loadCustomerHistory(supabase, customerContext?.customer?.id, message),
      loadExistingLead(proyecto_id, vid),
      loadProjectTools(supabase, proyecto_id),
    ]);
    const history = unifiedHistory.length ? unifiedHistory : legacyHistory;

    // Build system prompt and tools
    const systemPrompt = buildSystemPrompt(proyecto, config, existingLead, canal, customerContext);
    const tools = buildTools(hasEcommerce, ecommerce?.platform, actionTools);
    const toolContext = { proyecto, vid, canal, config, existingLead, toolConfigs, customer: customerContext?.customer };

    // Run agent loop
    const reply = await runAgentLoop(
      anthropic,
      { system: systemPrompt, tools, messages: [...history, { role: 'user', content: message }] },
      toolContext,
    );

    // Save assistant reply
    try {
      const { data: legacyMsg } = await supabase.from('conversaciones_chat').insert({
        proyecto_id, visitor_id: vid, canal, role: 'assistant', content: reply,
      }).select().single();
      await recordCustomerMessage(supabase, {
        proyectoId: proyecto_id,
        customerId: customerContext?.customer?.id,
        conversationId: customerContext?.conversation?.id,
        channel: canal,
        role: 'assistant',
        content: reply,
        legacyMessageId: legacyMsg?.id,
      });
    } catch (_) {}

    res.json({ reply });
  } catch (err) {
    console.error('chatbotRespond error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
