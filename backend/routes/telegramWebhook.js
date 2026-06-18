/**
 * Telegram Bot webhook.
 *
 * Each project can have its own Telegram bot. The bot token is stored in
 * proyecto.chatbot_config.telegram_bot_token.
 *
 * Webhook URL to register with Telegram:
 *   POST https://api.telegram.org/bot{TOKEN}/setWebhook
 *   Body: { "url": "https://api.genchats.app/api/telegram/webhook/{proyecto_id}" }
 *
 * Incoming updates arrive at:
 *   POST /api/telegram/webhook/:proyecto_id
 */

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

// POST /api/telegram/webhook/:proyecto_id
router.post('/webhook/:proyecto_id', async (req, res) => {
  // Always acknowledge immediately so Telegram doesn't retry
  res.json({ ok: true });

  try {
    const { proyecto_id } = req.params;
    const update = req.body;

    // ── Only handle regular text messages ─────────────────────────────────
    const message = update.message;
    if (!message || !message.text) return;

    const chatId     = message.chat.id;
    const fromId     = String(message.from?.id || chatId);
    const fromName   = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || null;
    const textoCliente = message.text.trim();
    if (!textoCliente) return;

    // ── Load project ──────────────────────────────────────────────────────
    const { data: proyecto, error: pErr } = await supabase
      .from('proyectos').select('*').eq('id', proyecto_id).single();
    if (pErr || !proyecto) {
      console.warn('[telegram] Project not found:', proyecto_id);
      return;
    }

    // Only reply for active projects
    if (proyecto.estado !== 'pro_activo' && proyecto.estado !== 'activo') return;

    const config = proyecto.chatbot_config || {};
    const botToken = proyecto.telegram_token;
    if (!botToken) {
      console.warn('[telegram] No bot token for project', proyecto_id);
      return;
    }

    // ── Human agent mode ──────────────────────────────────────────────────
    if (proyecto.modo_atencion === 'humano') return;

    // ── Message limit ─────────────────────────────────────────────────────
    const mensajesMes = proyecto.mensajes_mes || 0;
    const limiteMensajes = proyecto.limite_mensajes || 200;
    if (mensajesMes >= limiteMensajes) {
      await sendTelegram(chatId, 'Lo sentimos, hemos alcanzado el límite de mensajes este mes.', botToken);
      return;
    }

    // ── Visitor ID — use Telegram user ID (stable across chats) ──────────
    const vid = `tg_${fromId}`;

    // ── Save inbound message ──────────────────────────────────────────────
    await supabase.from('conversaciones_chat').insert({
      proyecto_id: proyecto.id,
      visitor_id: vid,
      canal: 'telegram',
      role: 'user',
      content: textoCliente,
    }).then(null, () => {});

    // ── Load history, lead and action tools ──────────────────────────────
    const [history, loadedLead, { enabledNames: actionTools, configs: toolConfigs }] = await Promise.all([
      loadHistory(proyecto.id, vid, textoCliente),
      loadExistingLead(proyecto.id, vid),
      loadProjectTools(supabase, proyecto.id),
    ]);
    let existingLead = loadedLead;

    // Auto-populate name if we have it from Telegram and lead doesn't have one yet
    if (fromName && existingLead && !existingLead.nombre) {
      existingLead = { ...existingLead, nombre: fromName };
    }

    // ── Build agent inputs ────────────────────────────────────────────────
    const ecommerce = proyecto.ecommerce_config;
    const hasEcommerce = !!(ecommerce?.enabled && ecommerce?.platform && ecommerce.platform !== 'otro');

    const systemPrompt = buildSystemPrompt(proyecto, config, existingLead, 'telegram');
    const tools = buildTools(hasEcommerce, ecommerce?.platform, actionTools);
    const toolContext = {
      proyecto,
      vid,
      canal: 'telegram',
      config,
      existingLead,
      toolConfigs,
    };

    // Show typing indicator while Claude thinks
    await sendTelegramAction(chatId, 'typing', botToken);

    // ── Run Claude agentic loop ───────────────────────────────────────────
    const anthropic = createAnthropicClient();
    const reply = await runAgentLoop(
      anthropic,
      { system: systemPrompt, tools, messages: [...history, { role: 'user', content: textoCliente }] },
      toolContext,
    );

    // ── Send reply and save ───────────────────────────────────────────────
    await sendTelegram(chatId, reply, botToken);

    await supabase.from('conversaciones_chat').insert({
      proyecto_id: proyecto.id,
      visitor_id: vid,
      canal: 'telegram',
      role: 'assistant',
      content: reply,
    }).then(null, () => {});

    await supabase.from('proyectos')
      .update({ mensajes_mes: mensajesMes + 1 })
      .eq('id', proyecto.id)
      .then(null, () => {});

    // If we captured the user's name from Telegram, save it in leads
    if (fromName && !existingLead) {
      await supabase.from('leads').upsert({
        proyecto_id: proyecto.id,
        visitor_id: vid,
        canal: 'telegram',
        nombre: fromName,
        ultimo_mensaje: new Date().toISOString(),
      }, { onConflict: 'proyecto_id,visitor_id' }).then(null, () => {});
    }

  } catch (err) {
    console.error('[telegram] Webhook processing error:', err.message);
  }
});

// ── Telegram Bot API helpers ───────────────────────────────────────────────

/**
 * Send a message to a Telegram chat using HTML parse_mode.
 * Converts common Markdown patterns to Telegram-compatible HTML.
 * HTML mode supports <b>, <i>, <a href="..."> — much simpler to escape than MarkdownV2.
 */
async function sendTelegram(chatId, text, botToken) {
  try {
    const html = markdownToTelegramHTML(text);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML' }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('[telegram] sendMessage error:', data);
      // Fallback: retry in plain text if HTML parse fails
      const fallback = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 $2') }),
      });
      return fallback.json();
    }
    return data;
  } catch (err) {
    console.error('[telegram] sendMessage exception:', err.message);
    return { ok: false };
  }
}

/**
 * Convert Claude's Markdown output to Telegram HTML.
 * Order matters: escape first, then apply formatting patterns.
 */
function markdownToTelegramHTML(text) {
  return text
    // 1. Escape HTML special chars in raw text (BEFORE adding any HTML tags)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 2. Markdown links [label](url) → <a href="url">label</a>
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    // 3. Plain URLs on their own (not already inside an href) → clickable link
    //    Negative lookbehind: skip URLs already inside href="..."
    .replace(/(?<!href=")((https?:\/\/)[^\s<>"]+)/g, '<a href="$1">$1</a>')
    // 4. **bold** → <b>bold</b>
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    // 5. *bold* (WhatsApp/single-star) → <b>bold</b>  (only if not already in a tag)
    .replace(/(?<![<\w])\*([^*\n]+)\*(?![>\w])/g, '<b>$1</b>')
    // 6. # headers → <b>text</b>
    .replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
    .trim();
}

/** Send a chat action (e.g. "typing" indicator). */
async function sendTelegramAction(chatId, action, botToken) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (_) {}
}

export default router;
