import 'dotenv/config';
import http from 'http';
import express from 'express';

// Evita que errores no capturados maten el proceso silenciosamente
process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 unhandledRejection:', reason);
});
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

// ── Routes ──
import scrapeUrlRouter from './routes/scrapeUrl.js';
import chatbotRespondRouter from './routes/chatbotRespond.js';
import ycloudWebhookRouter from './routes/ycloudWebhook.js';
import generarChatbotRouter from './routes/generarChatbot.js';
import generarPaginaRouter from './routes/generarPagina.js';
import stripeRouter from './routes/stripe.js';
import exportarRouter from './routes/exportar.js';
import notifyRouter from './routes/notify.js';
import ycloudRouter from './routes/ycloud.js';
import publicChatbotRouter from './routes/publicChatbot.js';
import queryProductsRouter from './routes/queryProducts.js';
import adminRouter from './routes/admin.js';
import telegramWebhookRouter from './routes/telegramWebhook.js';
import genaRouter from './routes/gena.js';
import conversationsRouter from './routes/conversations.js';
import leadsRouter from './routes/leads.js';
import { attachRetellWebSocket } from './routes/retellWebhook.js';
import monitorRouter from './routes/monitor.js';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Supabase client (service role) ──
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Middlewares ──
app.use(cors({ origin: '*' }));

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user || user.email !== 'lmllamas@gmail.com') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Raw body for Stripe webhooks (must be before express.json())
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/ycloud/webhook', express.json());
app.use('/api/telegram/webhook', express.json());

app.use(express.json({ limit: '10mb' }));

// ── Health check ──
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Monitor (n8n checks) ──
app.use('/api/monitor', monitorRouter);

// ── API Routes ──
app.use('/api/scrape', scrapeUrlRouter);
app.use('/api/chatbot', chatbotRespondRouter);
app.use('/api/chatbot-public', publicChatbotRouter);
app.use('/api/ycloud', ycloudWebhookRouter);
app.use('/api/generar-chatbot', generarChatbotRouter);
app.use('/api/generar-pagina', generarPaginaRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/exportar', exportarRouter);
app.use('/api/notify', notifyRouter);
app.use('/api/ycloud-config', ycloudRouter);
app.use('/api/products', queryProductsRouter);
app.use('/api/admin', requireAdmin, adminRouter);
app.use('/api/telegram', telegramWebhookRouter);
app.use('/api/gena',    genaRouter);
app.use('/api/conversations', requireAuth, conversationsRouter);
app.use('/api/leads', requireAuth, leadsRouter);

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

const server = http.createServer(app);
attachRetellWebSocket(server);
server.listen(PORT, () => {
  console.log(`✅ pagegen-api running on port ${PORT}`);
});
