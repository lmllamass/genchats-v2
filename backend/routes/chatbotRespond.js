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

    // Save user message
    try {
      await supabase.from('conversaciones_chat').insert({
        proyecto_id, visitor_id: vid, canal, role: 'user', content: message,
      });
    } catch (_) {}

    // Load history, lead and enabled action tools
    const [history, existingLead, { enabledNames: actionTools, configs: toolConfigs }] = await Promise.all([
      loadHistory(proyecto_id, vid, message),
      loadExistingLead(proyecto_id, vid),
      loadProjectTools(supabase, proyecto_id),
    ]);

    // Build system prompt and tools
    const systemPrompt = buildSystemPrompt(proyecto, config, existingLead, canal);
    const tools = buildTools(hasEcommerce, ecommerce?.platform, actionTools);
    const toolContext = { proyecto, vid, canal, config, existingLead, toolConfigs };

    // Run agent loop
    const reply = await runAgentLoop(
      anthropic,
      { system: systemPrompt, tools, messages: [...history, { role: 'user', content: message }] },
      toolContext,
    );

    // Save assistant reply
    try {
      await supabase.from('conversaciones_chat').insert({
        proyecto_id, visitor_id: vid, canal, role: 'assistant', content: reply,
      });
    } catch (_) {}

    res.json({ reply });
  } catch (err) {
    console.error('chatbotRespond error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
