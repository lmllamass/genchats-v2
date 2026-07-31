/**
 * whatsappSender.js — envío de WhatsApp compartido entre el agente IA (agentCore.js) y
 * el panel de operadoras (conversations.js). Una sola implementación de la comprobación
 * de ventana de 24h y del envío, para que no diverjan entre los dos sitios que envían.
 */

import { supabase } from '../server.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** ¿Ha escrito el cliente en las últimas 24h? Solo entonces se puede mandar texto libre. */
export async function isWindowOpen(proyectoId, to) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data } = await supabase
    .from('mensajes_wa')
    .select('created_at')
    .eq('proyecto_id', proyectoId)
    .eq('from_number', to)
    .eq('estado', 'recibido')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1);
  return !!data?.length;
}

function credentials(proyecto) {
  const apiKey = proyecto.ycloud_api_key || process.env.YCLOUD_API_KEY;
  const fromNumber = proyecto.ycloud_phone_number;
  if (!apiKey || !fromNumber) throw new Error('WhatsApp no está configurado para este negocio.');
  return { apiKey, fromNumber };
}

async function callYCloud(apiKey, body) {
  const res = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `YCloud ${res.status}`);
  return data;
}

/** Texto libre — falla explícitamente si la ventana de 24h está cerrada (no lo comprueba). */
export async function sendFreeText(proyecto, to, text) {
  const { apiKey, fromNumber } = credentials(proyecto);
  const data = await callYCloud(apiKey, { from: fromNumber, to, type: 'text', text: { body: text } });
  await supabase.from('mensajes_wa').insert({
    proyecto_id: proyecto.id, from_number: fromNumber, to_number: to,
    mensaje: text, wamid: data.id || null, estado: 'enviado',
  }).then(null, () => {});
  return data;
}

/**
 * Plantilla aprobada por Meta — funciona con la ventana abierta o cerrada, es la única
 * forma de reabrir una conversación pasadas 24h sin respuesta del cliente.
 * @param {string} bodyText - Solo para guardar en el histórico legible; YCloud usa `params`.
 */
export async function sendTemplate(proyecto, to, { name, language = 'es', params = [], bodyText }) {
  const { apiKey, fromNumber } = credentials(proyecto);
  const components = params.length
    ? [{ type: 'body', parameters: params.map(text => ({ type: 'text', text: String(text) })) }]
    : [];
  const data = await callYCloud(apiKey, {
    from: fromNumber, to, type: 'template',
    template: { name, language: { code: language }, components },
  });
  await supabase.from('mensajes_wa').insert({
    proyecto_id: proyecto.id, from_number: fromNumber, to_number: to,
    mensaje: bodyText || `[plantilla: ${name}]`, wamid: data.id || null, estado: 'enviado',
  }).then(null, () => {});
  return data;
}
