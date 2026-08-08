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
import { isSlotFree, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './googleCalendar.js';
import { isWindowOpen, sendFreeText, sendTemplate } from './whatsappSender.js';

// ── Fecha/hora actual, para que el modelo calcule fechas relativas ("mañana", "el lunes") ──
export function currentDateTimeLine() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return `FECHA Y HORA ACTUAL: ${fmt.format(now)} (hora de España). Úsala para calcular cualquier fecha relativa ("mañana", "el lunes que viene", "en dos semanas").`;
}

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
    description: 'Concertar una cita, reserva o visita para el cliente. Úsalo cuando el usuario quiera reservar, programar una cita o acordar una fecha. Antes de llamarla, calcula fecha_hora_iso a partir de la FECHA Y HORA ACTUAL que tienes en el contexto y de lo que diga el cliente.',
    input_schema: {
      type: 'object',
      properties: {
        nombre:            { type: 'string', description: 'Nombre completo del cliente' },
        telefono:          { type: 'string', description: 'Teléfono de contacto' },
        email:             { type: 'string', description: 'Email del cliente' },
        fecha_preferida:   { type: 'string', description: 'Fecha y hora preferida, tal como la dijo el cliente (ej: "mañana a las 10h", "15 de julio por la tarde") — para mostrarla tal cual en el aviso al dueño' },
        fecha_hora_iso:    { type: 'string', description: 'La misma fecha y hora, pero calculada por ti en formato ISO 8601 con offset horario de España (ej: "2026-07-25T10:00:00+02:00"). Si el cliente no da una hora exacta, usa una hora razonable en horario laboral (ej. 10:00). Obligatorio si quieres que la cita se añada de verdad al calendario.' },
        duracion_minutos:  { type: 'number', description: 'Duración estimada de la cita en minutos. Si no lo sabes, usa 30.' },
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
  consultar_disponibilidad: {
    name: 'consultar_disponibilidad',
    description: 'Consulta huecos libres para reservar (plazas de un curso, mesas de un restaurante, citas...). Úsalo SIEMPRE antes de reservar, para poder ofrecer opciones reales al cliente. Nunca inventes disponibilidad.',
    input_schema: {
      type: 'object',
      properties: {
        recurso:  { type: 'string', description: 'Nombre de la sede, local o sala. Omítelo si el negocio solo tiene uno.' },
        fecha:    { type: 'string', description: 'Fecha desde la que buscar, formato YYYY-MM-DD. Si el cliente dice "mañana" o "el jueves", calcula tú la fecha exacta.' },
        unidades: { type: 'number', description: 'Plazas necesarias (ej. nº de comensales de la mesa). Por defecto 1.' },
      },
      required: [],
    },
  },
  reservar_plaza: {
    name: 'reservar_plaza',
    description: 'Confirma una reserva en una fecha y hora concretas. Úsalo SOLO después de consultar_disponibilidad y de que el cliente haya elegido. Devuelve un código de reserva que debes darle.',
    input_schema: {
      type: 'object',
      properties: {
        fecha:     { type: 'string', description: 'Fecha de la reserva, formato YYYY-MM-DD.' },
        hora:      { type: 'string', description: 'Hora exacta de la franja elegida, formato HH:MM (una de las que devolvió consultar_disponibilidad).' },
        recurso:   { type: 'string', description: 'Sede/local elegido. Omítelo si solo hay uno.' },
        unidades:  { type: 'number', description: 'Plazas a reservar (comensales, alumnos...). Por defecto 1.' },
        nombre:    { type: 'string', description: 'Nombre del cliente.' },
        telefono:  { type: 'string', description: 'Teléfono de contacto. En llamadas, si no lo dice, se usa el suyo automáticamente.' },
        email:     { type: 'string', description: 'Email (opcional).' },
        documento: { type: 'string', description: 'DNI u otro documento, si el negocio lo pide.' },
        notas:     { type: 'string', description: 'Peticiones especiales (alergias, silla de bebé, accesibilidad...).' },
      },
      required: ['fecha', 'hora'],
    },
  },
  gestionar_reserva: {
    name: 'gestionar_reserva',
    description: 'Consulta, cambia o cancela una reserva que el cliente YA tiene. Si no te da el código, se busca automáticamente por su teléfono.',
    input_schema: {
      type: 'object',
      properties: {
        operacion:       { type: 'string', enum: ['consultar', 'modificar', 'cancelar'], description: 'Qué quiere hacer el cliente.' },
        codigo:          { type: 'string', description: 'Código de la reserva, si el cliente lo tiene a mano.' },
        nueva_fecha:     { type: 'string', description: 'Solo para modificar: nueva fecha YYYY-MM-DD.' },
        nueva_hora:      { type: 'string', description: 'Solo para modificar: nueva hora HH:MM.' },
        nuevo_recurso:   { type: 'string', description: 'Solo para modificar: nueva sede/local.' },
        nuevas_unidades: { type: 'number', description: 'Solo para modificar: nuevo nº de plazas/comensales.' },
        motivo:          { type: 'string', description: 'Solo para cancelar: motivo, si lo dice.' },
      },
      required: ['operacion'],
    },
  },
  enviar_whatsapp: {
    name: 'enviar_whatsapp',
    description: 'Envía un mensaje de WhatsApp al cliente. Úsalo cuando el usuario pida que le mandes información, un enlace, un resumen o cualquier texto por WhatsApp.',
    input_schema: {
      type: 'object',
      properties: {
        mensaje: { type: 'string', description: 'Texto del mensaje a enviar.' },
        to:      { type: 'string', description: 'Número en formato internacional. Si no se especifica, se usa el número del interlocutor.' },
      },
      required: ['mensaje'],
    },
  },
  enviar_email: {
    name: 'enviar_email',
    description: 'Envía un email al cliente con la información que pida. Úsalo cuando el cliente prefiera email, o como alternativa cuando el envío por WhatsApp haya fallado. Si no conoces su dirección, pregúntasela y repítesela para confirmarla antes de enviar.',
    input_schema: {
      type: 'object',
      properties: {
        email:   { type: 'string', description: 'Dirección de correo del cliente.' },
        asunto:  { type: 'string', description: 'Asunto del email, breve y concreto.' },
        mensaje: { type: 'string', description: 'Cuerpo del email. Puede incluir enlaces y varias líneas.' },
      },
      required: ['email', 'asunto', 'mensaje'],
    },
  },
  desviar_llamada: {
    name: 'desviar_llamada',
    description: 'Transfiere la llamada en curso a una persona en el teléfono del negocio. Úsala SOLO cuando el cliente pida explícitamente hablar con una persona, o cuando la consulta requiera claramente atención humana que tú no puedes resolver. Antes de llamarla, dile al cliente que le vas a transferir — la llamada se corta hacia esa persona justo después de tu respuesta.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Motivo breve de la transferencia, para tu propio contexto.' },
      },
      required: [],
    },
  },
};

// ── Tool definitions ───────────────────────────────────────────────────────
export function buildTools(hasEcommerce, ecommercePlatform, enabledActionTools = [], toolConfigs = {}) {
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
    if (!ACTION_TOOL_DEFS[toolName]) continue;
    // `custom` es genérica: sin decirle QUÉ acciones existen, el modelo las
    // adivina y acaba invocándolas como si fueran herramientas sueltas. Si el
    // proyecto las declara en project_tools.config.acciones, se las detallamos
    // aquí — el esquema de la herramienta pesa mucho más que el prompt.
    const acciones = toolName === 'custom' ? toolConfigs?.custom?.acciones : null;
    if (Array.isArray(acciones) && acciones.length) {
      const lista = acciones.map(a =>
        `- "${a.nombre}": ${a.descripcion}${a.datos ? ` — datos: ${a.datos}` : ''}`).join('\n');
      tools.push({
        ...ACTION_TOOL_DEFS.custom,
        description:
          'Ejecuta una de las acciones disponibles de este negocio. Llama SIEMPRE a esta '
          + 'herramienta ("custom") indicando la acción en el campo `accion`; las acciones '
          + 'NO existen como herramientas independientes.\n\nAcciones disponibles:\n' + lista,
        input_schema: {
          type: 'object',
          properties: {
            accion: { type: 'string', enum: acciones.map(a => a.nombre),
                      description: 'Acción a ejecutar (una de las listadas)' },
            datos:  { type: 'object', description: 'Datos que requiere esa acción' },
          },
          required: ['accion'],
        },
      });
    } else {
      tools.push(ACTION_TOOL_DEFS[toolName]);
    }
  }

  return tools;
}

// Aviso por email al dueño cuando se registra un pedido o una cita (fire-and-forget).
async function notifyOwnerAccion(config, proyecto, canal, titulo, campos) {
  try {
    if (!config?.notification_email) return;
    let resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      const { data: cfg } = await supabase.from('config_plataforma').select('resend_api_key').eq('clave', 'plataforma').single();
      resendKey = cfg?.resend_api_key;
    }
    if (!resendKey) return;
    const rows = Object.entries(campos)
      .filter(([, v]) => v)
      .map(([k, v]) => `<p style="margin:5px 0;font-size:14px"><strong>${k}:</strong> ${String(v).replace(/</g, '&lt;')}</p>`)
      .join('');
    const resend = new Resend(resendKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@genchats.app';
    await resend.emails.send({
      from: `GenChat IA <${fromEmail}>`,
      to: config.notification_email,
      subject: `${titulo} — ${config.nombre_negocio || proyecto.nombre}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:28px">
        <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:20px;border-radius:12px;margin-bottom:20px">
          <h2 style="color:white;margin:0">${titulo}</h2>
          <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px">${config.nombre_negocio || proyecto.nombre} · Canal: ${canal}</p>
        </div>
        ${rows}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
        <p style="color:#9ca3af;font-size:12px">Notificación automática de GenChat IA</p>
      </div>`,
    });
  } catch (e) {
    console.error('[notifyOwnerAccion] error:', e.message);
  }
}

// ── Tool executor ──────────────────────────────────────────────────────────
// ── Motor de reservas — helpers ────────────────────────────────────────────
// El aforo y la atomicidad viven en las RPC de Postgres (migración 010).
// Aquí solo traducimos entre el lenguaje del agente (nombres, "mañana") y la BD.

const RESERVAS_TZ = 'Europe/Madrid';

const normalizar = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Construye un ISO con el desfase horario REAL de esa fecha en España.
 * Sin esto, "13:00" se interpretaría como hora del servidor (UTC) y el evento
 * de Calendar caería 2 h desplazado en verano.
 */
function isoConZona(fecha, hora, tz = RESERVAS_TZ) {
  const hhmm = String(hora).slice(0, 5);
  const sonda = new Date(`${fecha}T12:00:00Z`);
  const etiqueta = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).format(sonda);
  const desfase = etiqueta.match(/GMT([+-]\d{2}:\d{2})/)?.[1] || '+00:00';
  return `${fecha}T${hhmm}:00${desfase}`;
}

function fechaLegible(fecha) {
  const d = new Date(`${fecha}T12:00:00Z`);
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: RESERVAS_TZ });
}

/** Resuelve el nombre que dice el cliente ("centro", "la de Gran Vía") al recurso real. */
async function resolverRecurso(proyectoId, nombre) {
  const { data } = await supabase
    .from('reservas_recursos')
    .select('id, nombre, direccion, maps_url, calendar_id')
    .eq('proyecto_id', proyectoId)
    .eq('activo', true);

  if (!data?.length) return { error: 'sin_recursos' };
  // Si el negocio solo tiene un sitio, no hace falta que el cliente lo nombre.
  if (!nombre) return data.length === 1 ? { recurso: data[0] } : { error: 'ambiguo', opciones: data };

  const n = normalizar(nombre);
  const exacto = data.find(r => normalizar(r.nombre) === n);
  if (exacto) return { recurso: exacto };
  const parcial = data.filter(r => normalizar(r.nombre).includes(n) || n.includes(normalizar(r.nombre)));
  if (parcial.length === 1) return { recurso: parcial[0] };
  return { error: 'ambiguo', opciones: parcial.length ? parcial : data };
}

/** Duración de la franja, para dimensionar el evento de calendario. */
async function duracionFranja(recursoId, fecha, hora) {
  const diaSemana = ((new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // ISO 1=lunes
  const { data } = await supabase
    .from('reservas_franjas')
    .select('duracion_min')
    .eq('recurso_id', recursoId)
    .eq('dia_semana', diaSemana)
    .eq('hora', `${String(hora).slice(0, 5)}:00`)
    .limit(1);
  return data?.[0]?.duracion_min || 60;
}

/** Texto compacto de disponibilidad. Por voz se recortan las opciones: nadie retiene 6 fechas dichas en alto. */
function formatDisponibilidad(filas, canal) {
  if (!filas?.length) return null;
  const maxOpciones = canal === 'phone' ? 3 : 6;
  const porFecha = new Map();
  for (const f of filas) {
    if (!porFecha.has(f.fecha)) porFecha.set(f.fecha, []);
    porFecha.get(f.fecha).push(f);
  }
  const bloques = [];
  for (const [fecha, items] of porFecha) {
    if (bloques.length >= maxOpciones) break;
    const horas = items.slice(0, 4).map(i => {
      const h = String(i.hora).slice(0, 5);
      return `${h} (${i.libres} libres)`;
    });
    const sede = items[0].recurso;
    bloques.push(`${fechaLegible(fecha)} en ${sede}: ${horas.join(', ')}`);
  }
  return bloques.join(' | ');
}

export async function executeTool(toolName, toolInput, toolContext) {
  const { proyecto, vid, canal, config, existingLead, customer, toolConfigs, callerPhone } = toolContext;
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

    case 'consultar_disponibilidad': {
      console.log(`[reservas] consultar_disponibilidad ${proyecto.id}`, JSON.stringify(toolInput));
      const res = await resolverRecurso(proyecto.id, toolInput.recurso);
      if (res.error === 'sin_recursos') {
        return 'Este negocio todavía no tiene configuradas sedes ni horarios reservables.';
      }
      // Si el cliente no ha dicho sede y hay varias, consultamos TODAS: es más útil
      // ofrecerle opciones que devolverle una pregunta.
      const recursoId = res.recurso?.id || null;

      const { data, error } = await supabase.rpc('reservas_disponibilidad', {
        p_proyecto: proyecto.id,
        p_recurso:  recursoId,
        p_desde:    toolInput.fecha || null,
        p_dias:     toolConfigs?.consultar_disponibilidad?.dias_vista || 21,
        p_unidades: Math.max(1, toolInput.unidades || 1),
      });
      if (error) {
        console.error('[consultar_disponibilidad] error:', error.message);
        return 'No he podido consultar la disponibilidad ahora mismo.';
      }

      const texto = formatDisponibilidad(data, canal);
      return texto
        ? `Huecos libres: ${texto}. Ofrécele estas opciones y espera a que elija.`
        : 'No quedan huecos libres en las próximas semanas con esos criterios.';
    }

    case 'reservar_plaza': {
      console.log(`[reservas] reservar_plaza ${proyecto.id}`, JSON.stringify(toolInput));
      const { fecha, hora } = toolInput;
      if (!fecha || !hora) return 'Necesito fecha y hora exactas para poder reservar.';

      const telefono = toolInput.telefono || callerPhone || existingLead?.telefono || null;
      if (!telefono) return 'Necesito un teléfono de contacto antes de confirmar la reserva. Pídeselo al cliente.';

      const res = await resolverRecurso(proyecto.id, toolInput.recurso);
      if (res.error === 'sin_recursos') return 'Este negocio no tiene sedes configuradas para reservar.';
      if (res.error === 'ambiguo') {
        return `Falta saber el sitio. Opciones: ${res.opciones.map(o => o.nombre).join(', ')}. Pregúntale al cliente cuál prefiere.`;
      }
      const recurso = res.recurso;
      const unidades = Math.max(1, toolInput.unidades || toolConfigs?.reservar_plaza?.unidades_default || 1);

      const { data, error } = await supabase.rpc('reservas_crear', {
        p_proyecto:   proyecto.id,
        p_recurso:    recurso.id,
        p_fecha:      fecha,
        p_hora:       String(hora).slice(0, 5),
        p_nombre:     toolInput.nombre || existingLead?.nombre || null,
        p_telefono:   telefono,
        p_unidades:   unidades,
        p_email:      toolInput.email || existingLead?.email || null,
        p_documento:  toolInput.documento || null,
        p_notas:      toolInput.notas || null,
        p_canal:      canal,
        p_visitor_id: vid,
        p_customer:   customer?.id || null,
      });
      if (error) {
        console.error('[reservar_plaza] error:', error.message);
        return 'No he podido completar la reserva ahora mismo. Ofrécele que le llamemos para confirmarla.';
      }

      if (!data.ok) {
        if (data.motivo === 'completo') {
          const { data: alt } = await supabase.rpc('reservas_disponibilidad', {
            p_proyecto: proyecto.id, p_recurso: recurso.id, p_desde: fecha, p_dias: 14, p_unidades: unidades,
          });
          const texto = formatDisponibilidad(alt, canal);
          return texto
            ? `Esa franja está completa (quedan ${data.libres} plazas). Alternativas: ${texto}. Pregúntale cuál le viene mejor.`
            : 'Esa franja está completa y no encuentro alternativas cercanas. Ofrécele que le avisemos si se libera.';
        }
        if (data.motivo === 'franja_inexistente') {
          return 'No hay servicio a esa hora ese día. Vuelve a consultar disponibilidad y ofrécele una franja válida.';
        }
        return 'No he podido completar la reserva. Ofrécele que le llamemos.';
      }

      if (data.duplicado) {
        return `El cliente YA tenía esa reserva. Su código es ${data.codigo}. Confírmaselo, no hace falta reservar de nuevo.`;
      }

      // Calendario: si falla, la reserva sigue siendo válida — nunca revertimos por esto.
      if (recurso.calendar_id) {
        try {
          const dur = await duracionFranja(recurso.id, fecha, hora);
          const ev = await createCalendarEvent(recurso.calendar_id, {
            summary: `Reserva ${data.codigo} · ${toolInput.nombre || 'Cliente'}${unidades > 1 ? ` (${unidades})` : ''}`,
            description: [
              `Código: ${data.codigo}`,
              toolInput.nombre ? `Nombre: ${toolInput.nombre}` : null,
              `Teléfono: ${telefono}`,
              toolInput.email ? `Email: ${toolInput.email}` : null,
              `Plazas: ${unidades}`,
              toolInput.notas ? `Notas: ${toolInput.notas}` : null,
              `Reservado vía ${canal} con GenChats.`,
            ].filter(Boolean).join('\n'),
            startISO: isoConZona(fecha, hora),
            durationMinutes: dur,
          });
          await supabase.from('reservas').update({ calendar_event_id: ev.id }).eq('id', data.reserva_id);
        } catch (err) {
          console.error('[reservar_plaza] Google Calendar error:', err.message);
        }
      }

      notifyOwnerAccion(config, proyecto, canal, '🗓️ Nueva reserva', {
        Código: data.codigo, Cliente: toolInput.nombre, Teléfono: telefono,
        Sitio: recurso.nombre, Fecha: `${fecha} ${String(hora).slice(0, 5)}`,
        Plazas: unidades, Notas: toolInput.notas,
      });

      const donde = recurso.direccion ? `${recurso.nombre} (${recurso.direccion})` : recurso.nombre;
      return `Reserva confirmada. Código ${data.codigo} · ${fechaLegible(fecha)} a las ${String(hora).slice(0, 5)} · ${donde}` +
             `${unidades > 1 ? ` · ${unidades} plazas` : ''}. Dale el código al cliente, deletreándolo si es una llamada.`;
    }

    case 'gestionar_reserva': {
      console.log(`[reservas] gestionar_reserva ${proyecto.id}`, JSON.stringify(toolInput));
      const op = toolInput.operacion;
      const codigo = toolInput.codigo ? String(toolInput.codigo).trim().toUpperCase() : null;
      const telefono = toolInput.telefono || callerPhone || existingLead?.telefono || null;

      if (!codigo && !telefono && !customer?.id) {
        return 'Necesito el código de la reserva o el teléfono del cliente para localizarla.';
      }

      const { data: encontradas, error: errBuscar } = await supabase.rpc('reservas_buscar', {
        p_proyecto: proyecto.id,
        p_codigo:   codigo,
        p_telefono: codigo ? null : telefono,
        p_customer: codigo ? null : (customer?.id || null),
      });
      if (errBuscar) {
        console.error('[gestionar_reserva] buscar:', errBuscar.message);
        return 'No he podido consultar las reservas ahora mismo.';
      }
      if (!encontradas?.length) {
        return 'No encuentro ninguna reserva activa a nombre de ese cliente. Confirma con él el código o el teléfono con el que reservó.';
      }

      const describir = r =>
        `${r.codigo} · ${fechaLegible(r.fecha)} a las ${String(r.hora).slice(0, 5)} · ${r.recurso}` +
        `${r.unidades > 1 ? ` · ${r.unidades} plazas` : ''}`;

      if (op === 'consultar') {
        return encontradas.length === 1
          ? `Su reserva: ${describir(encontradas[0])}.`
          : `Tiene ${encontradas.length} reservas: ${encontradas.map(describir).join(' | ')}.`;
      }

      if (encontradas.length > 1) {
        return `Tiene varias reservas: ${encontradas.map(describir).join(' | ')}. Pregúntale cuál quiere ${op === 'cancelar' ? 'cancelar' : 'cambiar'}.`;
      }
      const reserva = encontradas[0];

      if (op === 'cancelar') {
        const { data, error } = await supabase.rpc('reservas_cancelar', {
          p_proyecto: proyecto.id, p_codigo: reserva.codigo, p_motivo: toolInput.motivo || null,
        });
        if (error || !data?.ok) {
          console.error('[gestionar_reserva] cancelar:', error?.message || data?.motivo);
          return 'No he podido cancelar la reserva ahora mismo.';
        }

        if (data.calendar_event_id) {
          try {
            const { data: fila } = await supabase.from('reservas')
              .select('reservas_recursos(calendar_id)')
              .eq('proyecto_id', proyecto.id).eq('codigo', reserva.codigo).single();
            const calId = fila?.reservas_recursos?.calendar_id;
            if (calId) await deleteCalendarEvent(calId, data.calendar_event_id);
          } catch (err) {
            console.error('[gestionar_reserva] borrar evento:', err.message);
          }
        }

        notifyOwnerAccion(config, proyecto, canal, '❌ Reserva cancelada', {
          Código: reserva.codigo, Cliente: reserva.nombre_cliente,
          Fecha: `${reserva.fecha} ${String(reserva.hora).slice(0, 5)}`, Sitio: reserva.recurso,
          Motivo: toolInput.motivo,
          'En lista de espera': data.espera ? `${data.espera.nombre} (${data.espera.telefono})` : 'nadie',
        });

        return `Reserva ${reserva.codigo} cancelada y la plaza queda libre. Confírmaselo al cliente.`;
      }

      // modificar
      const nuevoRecurso = toolInput.nuevo_recurso
        ? (await resolverRecurso(proyecto.id, toolInput.nuevo_recurso)).recurso
        : null;
      if (toolInput.nuevo_recurso && !nuevoRecurso) {
        return 'No reconozco esa sede. Pregúntale al cliente cuál exactamente.';
      }

      const { data, error } = await supabase.rpc('reservas_modificar', {
        p_proyecto:        proyecto.id,
        p_codigo:          reserva.codigo,
        p_nuevo_recurso:   nuevoRecurso?.id || null,
        p_nueva_fecha:     toolInput.nueva_fecha || null,
        p_nueva_hora:      toolInput.nueva_hora ? String(toolInput.nueva_hora).slice(0, 5) : null,
        p_nuevas_unidades: toolInput.nuevas_unidades || null,
      });
      if (error) {
        console.error('[gestionar_reserva] modificar:', error.message);
        return 'No he podido cambiar la reserva ahora mismo.';
      }
      if (!data.ok) {
        if (data.motivo === 'completo') {
          return `Esa nueva franja está completa (quedan ${data.libres}). Consulta disponibilidad y ofrécele otra.`;
        }
        if (data.motivo === 'franja_inexistente') {
          return 'No hay servicio a esa hora ese día. Consulta disponibilidad y ofrécele una franja válida.';
        }
        return 'No he podido cambiar la reserva.';
      }
      if (data.sin_cambios) return 'La reserva ya estaba tal cual la pide. No hay nada que cambiar.';

      if (data.calendar_id && data.calendar_event_id) {
        try {
          const dur = await duracionFranja(data.recurso_id, data.fecha, data.hora);
          await updateCalendarEvent(data.calendar_id, data.calendar_event_id, {
            startISO: isoConZona(data.fecha, data.hora),
            durationMinutes: dur,
          });
        } catch (err) {
          console.error('[gestionar_reserva] actualizar evento:', err.message);
        }
      }

      notifyOwnerAccion(config, proyecto, canal, '✏️ Reserva modificada', {
        Código: data.codigo, Cliente: reserva.nombre_cliente,
        Antes: `${reserva.fecha} ${String(reserva.hora).slice(0, 5)} · ${reserva.recurso}`,
        Ahora: `${data.fecha} ${String(data.hora).slice(0, 5)}`, Plazas: data.unidades,
      });

      return `Reserva ${data.codigo} cambiada a ${fechaLegible(data.fecha)} a las ${String(data.hora).slice(0, 5)}` +
             `${data.unidades > 1 ? ` · ${data.unidades} plazas` : ''}. Confírmaselo al cliente.`;
    }

    case 'enviar_whatsapp': {
      const to = toolInput.to || callerPhone;
      if (!to) return 'No tengo el número de WhatsApp del cliente.';
      if (!proyecto.ycloud_phone_number) return 'WhatsApp no está configurado para este negocio.';

      try {
        // ¿Ventana de conversación abierta? (mensaje del cliente en las últimas 24h)
        const windowOpen = await isWindowOpen(proyecto.id, to);

        if (windowOpen) {
          await sendFreeText(proyecto, to, toolInput.mensaje);
        } else {
          // Enviar plantilla que manda el mensaje NO abre la ventana de 24h por sí sola
          // (solo la abre una respuesta real del cliente), así que si la ventana está
          // cerrada el mensaje completo va DENTRO de la plantilla, en una sola llamada.
          const businessName = config?.nombre_negocio || proyecto.nombre || 'nuestro negocio';
          // Las variables de plantilla no admiten saltos de línea ni espacios múltiples.
          let mensajeVar = toolInput.mensaje.replace(/\s*\n+\s*/g, ' · ').replace(/\s{2,}/g, ' ').trim();
          if (mensajeVar.length > 900) mensajeVar = mensajeVar.slice(0, 897) + '...';
          await sendTemplate(proyecto, to, {
            name: 'genchats_info_agente', language: 'es',
            params: [businessName, mensajeVar], bodyText: toolInput.mensaje,
          });
        }

        console.log(`📱 WhatsApp enviado a ${to} vía YCloud (${windowOpen ? 'ventana abierta' : 'vía plantilla genchats_info_agente'})`);

        // Sin esto, el envío proactivo (desde una llamada de voz o cualquier otro canal)
        // era invisible en la pantalla de conversaciones de la operadora: solo quedaba en
        // mensajes_wa, no en conversaciones_chat/conversaciones, que es lo que lee esa
        // pantalla. `to` es el número del cliente, no `vid` (que en voz es el call_id).
        await supabase.from('conversaciones_chat').insert({
          proyecto_id: proyecto.id, visitor_id: to, canal: 'whatsapp',
          role: 'assistant', content: toolInput.mensaje,
        }).then(null, () => {});
        await supabase.from('conversaciones').upsert({
          proyecto_id: proyecto.id, visitor_id: to, canal: 'whatsapp',
          last_message_at: new Date().toISOString(),
        }, { onConflict: 'proyecto_id,visitor_id,canal' }).then(null, () => {});

        return 'WhatsApp enviado correctamente.';
      } catch (err) {
        // El número y la causa importan: sin ellos el 403 de YCloud es indepurable.
        console.error(`[enviar_whatsapp] Error enviando a ${to} (ventana ${await isWindowOpen(proyecto.id, to) ? 'abierta' : 'cerrada'}):`, err.message);
        // Se le dice al modelo qué hacer, no solo que ha fallado: si no, se queda en
        // "hubo un problema" y deja al cliente sin la información que había pedido.
        return 'No se ha podido enviar el WhatsApp. Discúlpate brevemente y ofrécele enviárselo por email: pídele su dirección de correo, repítesela para confirmar que la has entendido bien, y usa la herramienta enviar_email.';
      }
    }

    case 'enviar_email': {
      const destino = (toolInput.email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
        return 'Esa dirección de email no parece válida. Pídele que te la repita, deletreada.';
      }
      try {
        // Remitente del propio negocio si lo tiene configurado y verificado en Resend;
        // si no, se envía desde la cuenta de plataforma con Reply-To del negocio, para
        // que la respuesta del cliente le llegue a él y no a un buzón que nadie lee.
        const propio = proyecto.email_activo && proyecto.email_remitente;
        const resendKey = (propio && proyecto.resend_api_key) || process.env.RESEND_API_KEY;
        if (!resendKey) {
          console.error('[enviar_email] No hay RESEND_API_KEY disponible');
          return 'No puedo enviar emails ahora mismo. Ofrécele otra vía de contacto.';
        }
        const negocio = config?.nombre_negocio || proyecto.nombre || 'nuestro negocio';
        const from = propio
          ? `${proyecto.email_remitente_nombre || negocio} <${proyecto.email_remitente}>`
          : `${negocio} <${process.env.RESEND_FROM_EMAIL || 'noreply@genchats.app'}>`;
        const replyTo = config?.email || config?.notification_email || undefined;

        const cuerpoHtml = String(toolInput.mensaje)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/\n/g, '<br>');

        const resend = new Resend(resendKey);
        const { error } = await resend.emails.send({
          from, to: destino, subject: toolInput.asunto || `Información de ${negocio}`,
          ...(replyTo ? { reply_to: replyTo } : {}),
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;font-size:15px;line-height:1.6;color:#111">
            ${cuerpoHtml}
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
            <p style="color:#9ca3af;font-size:12px">${negocio}</p>
          </div>`,
        });
        if (error) throw new Error(error.message);

        console.log(`✉️  Email enviado a ${destino} desde ${from} (proyecto ${proyecto.id})`);
        return `Email enviado correctamente a ${destino}.`;
      } catch (err) {
        console.error('[enviar_email] Error:', err.message);
        return 'No se ha podido enviar el email. Discúlpate y ofrécele que te deje un teléfono o que te lo pida por otro canal.';
      }
    }

    case 'desviar_llamada': {
      if (canal !== 'phone') return 'La transferencia de llamada solo está disponible por teléfono.';
      let destino = (config?.telefono || '').replace(/[^\d+]/g, '');
      if (!destino) {
        console.warn(`[desviar_llamada] Sin teléfono configurado (proyecto ${proyecto.id})`);
        return 'No hay un teléfono de transferencia configurado para este negocio. Discúlpate y ofrécele otra vía de contacto.';
      }
      // Los teléfonos de negocio se guardan a veces sin prefijo de país (ej. "689 65 61 22").
      // Todos los negocios de esta plataforma son españoles, así que si no hay un "+" delante
      // se asume +34 — sin esto Retell recibe un transfer_number inválido y no transfiere nada.
      if (!destino.startsWith('+')) destino = `+34${destino.replace(/^0+/, '')}`;
      // No se llama a ninguna API aquí: retellWebhook.js lee toolContext.transferNumber
      // tras el bucle del agente y añade `transfer_number` a la respuesta final del turno —
      // es Retell quien ejecuta la transferencia SIP real en cuanto recibe ese campo.
      toolContext.transferNumber = destino;
      console.log(`📞 Transferencia solicitada a ${toolContext.transferNumber} (proyecto ${proyecto.id}, motivo: ${toolInput.motivo || 'sin especificar'})`);
      return 'Transferencia iniciada. Dile al cliente que le vas a pasar con una persona ahora mismo, en una frase breve — no digas nada más después.';
    }

    case 'capturar_pedido': {
      const datos = {};
      if (toolInput.nombre)    datos.nombre    = toolInput.nombre;
      if (toolInput.productos) datos.productos = toolInput.productos;
      if (toolInput.direccion) datos.direccion = toolInput.direccion;
      if (toolInput.notas)     datos.notas     = toolInput.notas;
      const { error } = await supabase.from('pedidos').insert({
        proyecto_id: proyecto.id,
        visitor_id: vid,
        canal,
        datos,
        telefono_cliente: toolInput.telefono || callerPhone || null,
        email_cliente: toolInput.email || null,
      });
      if (error) { console.error('[capturar_pedido] error:', error.message); return 'No pude registrar el pedido en el sistema. Inténtalo de nuevo.'; }
      notifyOwnerAccion(config, proyecto, canal, '🛒 Nuevo pedido', {
        Cliente: toolInput.nombre, Teléfono: toolInput.telefono || callerPhone, Email: toolInput.email,
        Productos: toolInput.productos, Dirección: toolInput.direccion, Notas: toolInput.notas,
      });
      return 'Pedido registrado correctamente. Nos pondremos en contacto para confirmarlo.';
    }

    case 'concertar_cita': {
      const calendarId = toolConfigs?.concertar_cita?.calendar_id;
      const duracion = toolInput.duracion_minutos || 30;
      let calendarEventId = null;

      if (calendarId && toolInput.fecha_hora_iso) {
        try {
          const libre = await isSlotFree(calendarId, toolInput.fecha_hora_iso, duracion);
          if (!libre) {
            return 'Ese horario ya está ocupado en el calendario. ¿Puede el cliente proponer otra fecha u hora?';
          }
          const event = await createCalendarEvent(calendarId, {
            summary: `Cita: ${toolInput.nombre || 'Cliente'}${toolInput.motivo ? ' — ' + toolInput.motivo : ''}`,
            description: [
              toolInput.nombre ? `Cliente: ${toolInput.nombre}` : null,
              (toolInput.telefono || callerPhone) ? `Teléfono: ${toolInput.telefono || callerPhone}` : null,
              toolInput.email ? `Email: ${toolInput.email}` : null,
              toolInput.motivo ? `Motivo: ${toolInput.motivo}` : null,
              `Reservado vía ${canal} con GenChats.`,
            ].filter(Boolean).join('\n'),
            startISO: toolInput.fecha_hora_iso,
            durationMinutes: duracion,
          });
          calendarEventId = event.id;
        } catch (err) {
          console.error('[concertar_cita] Google Calendar error:', err.message);
          // Degrada con elegancia: seguimos registrando la cita internamente aunque falle el calendario.
        }
      }

      const { error } = await supabase.from('citas').insert({
        proyecto_id: proyecto.id,
        visitor_id: vid,
        canal,
        nombre_cliente: toolInput.nombre || null,
        telefono_cliente: toolInput.telefono || callerPhone || null,
        email_cliente: toolInput.email || null,
        fecha_solicitada: toolInput.fecha_preferida || toolInput.fecha_hora_iso || null,
        motivo: toolInput.motivo || null,
        calendar_event_id: calendarEventId,
      });
      if (error) { console.error('[concertar_cita] error:', error.message); return 'No pude registrar la cita en el sistema. Inténtalo de nuevo.'; }
      notifyOwnerAccion(config, proyecto, canal, calendarEventId ? '📅 Nueva cita (añadida al calendario)' : '📅 Nueva cita solicitada', {
        Cliente: toolInput.nombre, Teléfono: toolInput.telefono || callerPhone, Email: toolInput.email,
        Fecha: toolInput.fecha_preferida || toolInput.fecha_hora_iso, Motivo: toolInput.motivo,
      });
      return calendarEventId
        ? 'Cita confirmada y añadida al calendario.'
        : 'Cita registrada. Te confirmaremos la disponibilidad en breve.';
    }

    default: {
      // Delegate to n8n webhook if this is a registered action tool (ej. 'custom')
      const esAccionDeCustom = !ACTION_TOOL_DEFS[toolName] && toolConfigs?.custom;
      if (Object.prototype.hasOwnProperty.call(ACTION_TOOL_DEFS, toolName) || esAccionDeCustom) {
        // El modelo invoca con frecuencia la ACCIÓN como si fuera una herramienta
        // (`solicitar_documentacion(...)` en vez de `custom({accion, datos})`),
        // por muy explícito que sea el prompt. En vez de fallar, lo reencaminamos:
        // es un comportamiento predecible del LLM y el sistema debe tolerarlo.
        if (esAccionDeCustom) {
          console.log(`[actions] '${toolName}' llamada como herramienta; reencaminada a custom`);
          toolInput = { accion: toolName, datos: toolInput };
          toolName = 'custom';
        }
        const toolConfig = toolConfigs?.[toolName] || {};
        const backendUrl = process.env.API_PUBLIC_URL || '';
        const projectContext = {
          nombre:               proyecto.nombre,
          ycloud_api_key:       proyecto.ycloud_api_key || process.env.YCLOUD_API_KEY || '',
          ycloud_phone_number:  proyecto.ycloud_phone_number || '',
          visitor_id:           vid || '',
          canal:                canal || '',
          // El contacto unificado: lo necesita cualquier acción que cuelgue algo
          // de la persona y no del hilo — p. ej. pedirle un enlace de archivos.
          customer_id:          customer?.id || '',
          reply_webhook_url:    backendUrl ? `${backendUrl}/api/chatbot-public/${proyecto.id}/async-reply` : '',
        };
        const result = await callActionWebhook(proyecto.id, toolName, toolInput, toolConfig, projectContext);
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
 *   onToolStart()   -> se llama una vez al empezar a ejecutar herramientas (por turno)
 *                      (para enviar una muletilla de espera al cliente)
 * Si no se pasa onDelta, se usa el camino clásico sin streaming (web/WhatsApp/Telegram).
 */
export async function runAgentLoop(anthropic, { system, tools, messages }, toolContext, maxIter = 4, hooks = {}) {
  const { onDelta, onToolStart } = hooks;
  const streaming = typeof onDelta === 'function';
  let currentMessages = [...messages];
  let fillerFired = false;

  // El tope no cuesta nada si no se gasta, y quedarse corto sí: al truncar en
  // mitad de un bloque tool_use la respuesta llega SIN texto y sin herramienta
  // que ejecutar, y el turno se perdía con un "no pude procesar tu consulta".
  const MAX_TOKENS = 1024;
  const MAX_TOKENS_REINTENTO = 2048;

  const pedirRespuesta = async (maxTokens) => {
    if (streaming) {
      const stream = anthropic.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system,
        tools,
        messages: currentMessages,
      });
      stream.on('text', (delta) => { onDelta(delta); });
      return stream.finalMessage();
    }
    return callWithRetry(() =>
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system,
        tools,
        messages: currentMessages,
      })
    );
  };

  /** Ejecuta en paralelo todas las herramientas que pida una respuesta. */
  const ejecutarHerramientas = (respuesta) => Promise.all(
    respuesta.content.filter(b => b.type === 'tool_use').map(async (tu) => {
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

  for (let iter = 0; iter < maxIter; iter++) {
    let response = await pedirRespuesta(MAX_TOKENS);

    if (response.stop_reason === 'max_tokens') {
      console.warn(`[agente] respuesta truncada por max_tokens (iter ${iter})`);
    }

    // Final answer
    if (response.stop_reason !== 'tool_use') {
      let textBlock = response.content.find(b => b.type === 'text');

      // Sin texto y sin herramienta: no hay nada que devolverle al cliente. Es
      // recuperable —al usuario que lo sufrió le bastó con escribir "¿por qué
      // no?" para que funcionara—, así que se reintenta una vez con más margen.
      // Es seguro incluso en streaming: si no hay bloque de texto es que no se
      // ha emitido ningún delta, así que no se duplica nada por pantalla.
      if (!textBlock?.text) {
        console.warn('[agente] respuesta sin texto utilizable — stop_reason: '
          + `${response.stop_reason}, bloques: [${response.content.map(b => b.type).join(', ')}]. Reintentando.`);
        response = await pedirRespuesta(MAX_TOKENS_REINTENTO);
        textBlock = response.content.find(b => b.type === 'text');
        // Si el reintento sí pide herramientas, se sigue el flujo normal.
        if (response.stop_reason === 'tool_use') {
          if (streaming && onToolStart && !fillerFired) {
            fillerFired = true;
            try { onToolStart(); } catch { /* noop */ }
          }
          const resultados = await ejecutarHerramientas(response);
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: response.content },
            { role: 'user',      content: resultados },
          ];
          continue;
        }
      }

      if (!textBlock?.text) {
        console.error('[agente] el reintento tampoco dio texto — stop_reason: ' + response.stop_reason);
      }
      return textBlock?.text || 'Lo siento, no pude procesar tu consulta.';
    }

    // Va a ejecutar herramientas: lanza una muletilla mientras corre (una vez por turno).
    // No se condiciona a "sin texto previo": Claude casi siempre dice algo natural antes
    // de llamar a una tool (p.ej. "Perfecto, te lo envío..."), así que esa comprobación
    // nunca se cumplía en la práctica y la muletilla no sonaba nunca.
    if (streaming && onToolStart && !fillerFired) {
      fillerFired = true;
      try { onToolStart(); } catch { /* noop */ }
    }

    const toolResults = await ejecutarHerramientas(response);

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
/**
 * Instrucciones de reservas. Se inyectan SOLO si el proyecto tiene activas las tools
 * del motor de reservas, igual que ecommerceNote con la tienda.
 *
 * El punto crítico es la primera regla: sin ella el modelo llegaba a responder
 * "tu reserva ha sido cancelada" SIN haber llamado nunca a la herramienta —
 * alucinaba la confirmación. Detectado en pruebas el 2026-07-28.
 */
export function buildReservasNote(enabledTools = []) {
  const tiene = t => enabledTools.includes(t);
  if (!tiene('consultar_disponibilidad') && !tiene('reservar_plaza') && !tiene('gestionar_reserva')) return '';

  const lineas = ['\n\nRESERVAS — REGLAS ESTRICTAS:',
    '- NUNCA digas que una reserva está hecha, cambiada o cancelada si no has llamado a la herramienta correspondiente y te ha devuelto confirmación. No lo des por hecho ni lo supongas: si no llamas a la herramienta, NO ha pasado nada en el sistema.',
    '- No inventes disponibilidad, horarios ni códigos de reserva.'];
  if (tiene('consultar_disponibilidad')) lineas.push('- Para ver huecos libres usa consultar_disponibilidad. Ofrece solo lo que devuelva.');
  if (tiene('reservar_plaza'))           lineas.push('- Para crear una reserva usa reservar_plaza, solo después de que el cliente haya elegido fecha y hora concretas. Dale siempre el código que devuelve.');
  if (tiene('gestionar_reserva'))        lineas.push('- Para consultar, cambiar o CANCELAR una reserva existente usa gestionar_reserva con la operación correspondiente. Si el cliente no recuerda el código, la herramienta la busca por su teléfono.');
  return lineas.join('\n');
}

/**
 * Aviso de privacidad en el primer contacto.
 *
 * Vamos a guardar los datos de una persona que no ha firmado nada: lo mínimo es
 * decírselo y remitirla a las condiciones del negocio. Solo se inyecta si el
 * tenant ha publicado su política — sin documento detrás, el aviso no vale nada
 * y solo estorba la conversación.
 *
 * En voz no se dicta la URL (ver la variante del prompt telefónico): se menciona
 * de palabra y se ofrece enviarla por escrito.
 */
export function buildPrivacidadNote(config, canal = 'web') {
  const url = (config?.url_privacidad || '').trim();
  if (!url) return '';

  const negocio = config?.nombre_negocio || 'el negocio';
  return '\n\nPRIVACIDAD — SOLO EN TU PRIMER MENSAJE DE LA CONVERSACIÓN:'
    + `\n- Cierra ese primer mensaje con una línea breve: que los datos que facilite los tratará ${negocio} para atender su solicitud, y que puede consultar las condiciones en ${url}`
    + '\n- Una sola frase, al final, sin dramatizar. No es un formulario ni hay que pedirle que conteste "acepto".'
    + '\n- NO lo repitas en los mensajes siguientes ni cada vez que le pidas un dato. Una vez por conversación y se acabó.'
    + '\n- Si te pregunta por sus datos, qué guardáis o cómo borrarlos, remítele a esa misma dirección.';
}

export function buildSystemPrompt(proyecto, config, existingLead, canal = 'web', customerContext = null, enabledTools = []) {
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

${currentDateTimeLine()}

INFORMACIÓN DEL NEGOCIO:
${config.knowledge_base || config.descripcion || 'Sin información adicional.'}

CONTACTO:
${config.telefono ? `- Teléfono: ${config.telefono}` : ''}
${config.email ? `- Email: ${config.email}` : ''}
- Web: ${proyecto.url_origen || ''}

${formatInstructions}${ecommerceNote}${buildReservasNote(enabledTools)}${buildPrivacidadNote(config, canal)}${leadContext}${omnichannelContext}`;
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
  // order(ascending:false) + limit trae los últimos N mensajes reales; luego se invierten a
  // orden cronológico. (Antes se pedía ascending+limit, que en conversaciones largas siempre
  // devolvía los N mensajes MÁS ANTIGUOS de toda la historia, no los más recientes — el agente
  // "olvidaba" todo lo hablado después del mensaje 30 en clientes recurrentes.)
  const { data: historial } = await supabase
    .from('conversaciones_chat')
    .select('role,content')
    .eq('proyecto_id', proyecto_id)
    .eq('visitor_id', visitor_id)
    .order('created_at', { ascending: false })
    .limit(40);

  let history = [];
  if (historial) {
    const cronologico = [...historial].reverse();
    for (let i = 0; i < cronologico.length; i++) {
      // Skip the message just inserted (last user message)
      if (i === cronologico.length - 1 && cronologico[i].role === 'user' && cronologico[i].content === currentMessage) continue;
      history.push({ role: cronologico[i].role, content: cronologico[i].content });
    }
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
