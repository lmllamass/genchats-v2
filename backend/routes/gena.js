/**
 * gena.js — Endpoint dedicado para el widget Gena de la landing de GenChats.
 * No requiere proyecto en BD. Historia gestionada por el cliente.
 * Leads se guardan en tabla leads + notificación por email.
 */

import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import { supabase } from '../server.js';
import { callWithRetry } from '../lib/agentCore.js';

const router = express.Router();

// UUID fijo para el "proyecto" Gena en la BD (válido como UUID)
const GENA_PROJECT_UUID = '00000000-0000-0000-0000-000000000001';

// ── System prompt ──────────────────────────────────────────────────────────
const GENA_SYSTEM_PROMPT = `Eres Gena ✨, la asistente virtual de GenChats IA (genchats.app).
Tu misión: atender a potenciales clientes que visitan la web, explicar cómo funciona la plataforma, resolver dudas y — cuando sea natural — captar sus datos de contacto y proponerles una videollamada o demo personalizada.

════════════════════════════════════════
SOBRE GENCHATS IA
════════════════════════════════════════
GenChats IA permite a cualquier negocio crear su propio chatbot de inteligencia artificial en minutos, sin programar.

CÓMO FUNCIONA (3 pasos):
1. Pegas la URL de tu web → la IA analiza tu negocio automáticamente
2. Personalizas el chatbot (nombre, color, personalidad) en 2 minutos
3. Lo instalas en tu web con un snippet, en WhatsApp Business o en Telegram

CARACTERÍSTICAS PRINCIPALES:
• 🤖 IA con Claude (Anthropic) — responde como un empleado experto en tu negocio
• 💬 Multicanal: Web embed, WhatsApp Business y Telegram Bot
• 🛒 Integración ecommerce: WooCommerce, Google Sheets, Odoo
• 🎯 Captación de leads automática (nombre, email, teléfono)
• 📧 Notificación por email cuando llega un nuevo lead
• 📊 Panel de administración completo (conversaciones, métricas, leads)
• 🔄 Modo coexistencia: bot + agente humano simultáneamente
• 🌍 Responde en el idioma del usuario automáticamente

CASOS DE USO FRECUENTES:
• Tiendas online: dudas sobre productos, stock, precios — 24/7
• Restaurantes: reservas, carta, horarios, alérgenos
• Inmobiliarias: consultas de propiedades, visitas
• Clínicas y centros de estética: citas, servicios, precios
• Servicios profesionales: presupuestos, disponibilidad, portfolio

PRECIOS:
• 🆓 Free: 7 días de prueba gratis, hasta 200 mensajes/mes
• 🚀 Pro: 47 €/mes — mensajes ilimitados, hasta 3 proyectos, todos los canales
• 🏢 Agencia: 197 €/mes — proyectos ilimitados, posibilidad de marca blanca

LINKS ÚTILES:
• Web: https://genchats.app
• Demo interactiva: https://genchats.app/demo
• Registro gratis: https://genchats.app/login
• Email contacto: info@genchats.app

════════════════════════════════════════
INSTRUCCIONES DE COMPORTAMIENTO
════════════════════════════════════════
• Sé amable, directa y cercana. Emojis con moderación.
• Responde SIEMPRE en el idioma del usuario.
• Respuestas concisas: máximo 3-4 frases salvo que expliques algo técnico.
• Si preguntan por precios, dáselos sin rodeos.
• Cuando el usuario muestre interés real (pregunta cómo empezar, por su tipo de negocio, por precios), propón de forma natural dejar sus datos: "¿Te paso más info o prefieres que te contactemos directamente?"
• Si el usuario da nombre + email (o solo email), llama INMEDIATAMENTE a guardar_lead.
• Si el usuario pide demo, reunión o hablar con alguien, llama INMEDIATAMENTE a solicitar_demo.
• NUNCA inventes funcionalidades que no existen.
• Cuando no tengas respuesta clara, ofrece hablar con el equipo.
• NO menciones que eres una IA salvo que te lo pregunten directamente.

TONO: Profesional pero cercano. Como un comercial que sabe mucho del producto y quiere ayudar de verdad.`;

// ── Tool definitions ───────────────────────────────────────────────────────
const GENA_TOOLS = [
  {
    name: 'guardar_lead',
    description: 'Guarda los datos de contacto del visitante en la base de datos y envía una notificación al equipo. LLAMA DE INMEDIATO en cuanto el usuario mencione su nombre, email o teléfono — aunque sea un solo dato.',
    input_schema: {
      type: 'object',
      properties: {
        nombre:   { type: 'string', description: 'Nombre completo del visitante' },
        email:    { type: 'string', description: 'Dirección de email' },
        telefono: { type: 'string', description: 'Número de teléfono' },
        empresa:  { type: 'string', description: 'Nombre de la empresa o negocio' },
        interes:  { type: 'string', description: 'Qué tipo de negocio tiene o qué busca (1-2 frases)' },
      },
      required: [],
    },
  },
  {
    name: 'solicitar_demo',
    description: 'Registra que el visitante quiere una demo o videollamada con el equipo. Llama cuando pida demo, reunión, videollamada o hablar con alguien.',
    input_schema: {
      type: 'object',
      properties: {
        nombre:   { type: 'string', description: 'Nombre del visitante (si se conoce)' },
        email:    { type: 'string', description: 'Email del visitante (si se conoce)' },
        telefono: { type: 'string', description: 'Teléfono (si se conoce)' },
        empresa:  { type: 'string', description: 'Empresa (si se conoce)' },
        mensaje:  { type: 'string', description: 'Resumen de su interés o tipo de negocio' },
      },
      required: [],
    },
  },
];

// ── Route: POST /api/gena/message ──────────────────────────────────────────
router.post('/message', async (req, res) => {
  try {
    const { message, visitor_id, history = [] } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const vid = visitor_id || ('gena_' + Date.now().toString(36));

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build messages from client-side history + current message
    // history already validated: array of {role, content}
    const safeHistory = Array.isArray(history)
      ? history.slice(-20).map(m => ({ role: m.role, content: String(m.content || '') }))
      : [];

    let currentMessages = [...safeHistory, { role: 'user', content: message }];
    let reply = '';
    const toolsExecuted = [];

    for (let iter = 0; iter < 4; iter++) {
      const response = await callWithRetry(() =>
        anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: GENA_SYSTEM_PROMPT,
          tools: GENA_TOOLS,
          messages: currentMessages,
        })
      );

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find(b => b.type === 'text');
        reply = textBlock?.text || '¡Hola! ¿En qué puedo ayudarte?';
        break;
      }

      // Execute tool calls
      const toolUses = response.content.filter(b => b.type === 'tool_use');
      const toolResults = await Promise.all(
        toolUses.map(async (tu) => {
          let content = '';
          try {
            if (tu.name === 'guardar_lead') {
              content = await handleGuardarLead(tu.input, vid);
              toolsExecuted.push('guardar_lead');
            } else if (tu.name === 'solicitar_demo') {
              content = await handleSolicitarDemo(tu.input, vid);
              toolsExecuted.push('solicitar_demo');
            }
          } catch (e) {
            console.error(`Gena tool ${tu.name} error:`, e.message);
            content = JSON.stringify({ ok: false, error: e.message });
          }
          return { type: 'tool_result', tool_use_id: tu.id, content };
        })
      );

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user',      content: toolResults },
      ];
    }

    if (!reply) {
      reply = 'Lo siento, no pude procesar tu consulta. Inténtalo de nuevo.';
    }

    res.json({ reply, visitor_id: vid });
  } catch (err) {
    console.error('Gena /message error:', err);
    res.status(500).json({ error: err.message || 'Error interno' });
  }
});

// ── Tool handlers ──────────────────────────────────────────────────────────

async function handleGuardarLead(input, vid) {
  const payload = {
    visitor_id: vid,
    canal: 'web',
    ultimo_mensaje: new Date().toISOString(),
  };
  if (input.nombre)   payload.nombre   = input.nombre;
  if (input.email)    payload.email    = input.email;
  if (input.telefono) payload.telefono = input.telefono;
  if (input.empresa)  payload.empresa  = input.empresa;
  if (input.interes)  payload.notas    = input.interes;

  // Intentar guardar en tabla leads (puede fallar si FK constraint)
  try {
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('visitor_id', vid)
      .eq('proyecto_id', GENA_PROJECT_UUID)
      .limit(1);

    if (existing?.length) {
      await supabase.from('leads').update(payload).eq('id', existing[0].id);
    } else {
      await supabase.from('leads').insert({ ...payload, proyecto_id: GENA_PROJECT_UUID });
    }
  } catch (dbErr) {
    // Ignorar errores de BD (FK constraint si proyecto no existe); el email es suficiente
    console.warn('Gena lead DB warning:', dbErr.message);
  }

  // Siempre enviar email
  await sendLeadEmail({ ...input, tipo: 'lead' });

  return JSON.stringify({ guardado: true });
}

async function handleSolicitarDemo(input, vid) {
  const notasDemo = `🎥 SOLICITA DEMO/VIDEOLLAMADA. ${input.mensaje || ''}`.trim();
  const payload = {
    visitor_id: vid,
    canal: 'web',
    ultimo_mensaje: new Date().toISOString(),
    notas: notasDemo,
  };
  if (input.nombre)   payload.nombre   = input.nombre;
  if (input.email)    payload.email    = input.email;
  if (input.telefono) payload.telefono = input.telefono;
  if (input.empresa)  payload.empresa  = input.empresa;

  try {
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('visitor_id', vid)
      .eq('proyecto_id', GENA_PROJECT_UUID)
      .limit(1);

    if (existing?.length) {
      await supabase.from('leads').update(payload).eq('id', existing[0].id);
    } else {
      await supabase.from('leads').insert({ ...payload, proyecto_id: GENA_PROJECT_UUID });
    }
  } catch (dbErr) {
    console.warn('Gena demo DB warning:', dbErr.message);
  }

  await sendLeadEmail({ ...input, interes: input.mensaje, tipo: 'demo' });

  return JSON.stringify({ demo_registrada: true });
}

// ── Email helper ───────────────────────────────────────────────────────────
async function sendLeadEmail(input) {
  try {
    // Obtener API key: env var primero, luego config_plataforma
    let resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      const { data: cfg } = await supabase
        .from('config_plataforma')
        .select('resend_api_key')
        .eq('clave', 'plataforma')
        .single();
      resendKey = cfg?.resend_api_key;
    }
    if (!resendKey) {
      console.warn('Gena email skipped: RESEND_API_KEY not configured');
      return;
    }

    const resend     = new Resend(resendKey);
    const fromEmail  = process.env.RESEND_FROM_EMAIL || 'noreply@genchats.app';
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'info@konkabeza.es';
    const isDemo     = input.tipo === 'demo';

    const subject = isDemo
      ? `🎥 Solicitud de DEMO — ${input.nombre || 'Visitante'} quiere una videollamada`
      : `🎯 Nuevo lead landing — ${input.nombre || 'Visitante'} (GenChats.app)`;

    const rowHtml = (label, value) =>
      value ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:90px">${label}</td><td style="padding:6px 0;font-size:13px;color:#111827">${value}</td></tr>` : '';

    await resend.emails.send({
      from: `Gena · GenChats <${fromEmail}>`,
      to: adminEmail,
      subject,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#ffffff">

          <!-- Header -->
          <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:22px 26px;border-radius:14px;margin-bottom:24px">
            <h2 style="color:white;margin:0;font-size:20px;font-weight:700">
              ${isDemo ? '🎥 Nueva solicitud de demo' : '🎯 Nuevo lead desde la landing'}
            </h2>
            <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px">
              Widget Gena · genchats.app
            </p>
          </div>

          <!-- Datos del contacto -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;margin-bottom:20px">
            <h3 style="margin:0 0 12px;color:#374151;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em">
              📋 Datos del contacto
            </h3>
            <table style="width:100%;border-collapse:collapse">
              ${rowHtml('Nombre', input.nombre)}
              ${rowHtml('Email', input.email ? `<a href="mailto:${input.email}" style="color:#4f46e5">${input.email}</a>` : null)}
              ${rowHtml('Teléfono', input.telefono ? `<a href="tel:${input.telefono}" style="color:#4f46e5">${input.telefono}</a>` : null)}
              ${rowHtml('Empresa', input.empresa)}
              ${rowHtml('Interés', input.interes || input.mensaje)}
            </table>
          </div>

          ${isDemo ? `
          <!-- Call to action demo -->
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin-bottom:20px">
            <p style="margin:0;font-size:14px;color:#92400e;font-weight:600">
              ⚡ Este visitante quiere una demo/videollamada. Contáctale cuanto antes.
            </p>
          </div>` : ''}

          <hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0"/>
          <p style="color:#94a3b8;font-size:12px;margin:0">
            Notificación automática de <a href="https://genchats.app" style="color:#4f46e5;text-decoration:none">GenChats IA</a>
          </p>
        </div>
      `,
    });

    console.log(`📧 Gena lead email → ${adminEmail} [${input.tipo}]`);
  } catch (e) {
    console.error('Gena sendLeadEmail error:', e.message);
  }
}

export default router;
