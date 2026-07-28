/**
 * googleCalendar.js — Integración real con Google Calendar para concertar_cita.
 * Usa UNA cuenta de servicio (GOOGLE_CALENDAR_SA_KEY) compartida por toda la plataforma;
 * cada tenant comparte SU PROPIO calendario con el email de esa cuenta de servicio y pega
 * el Calendar ID en el admin. No hay OAuth por tenant — es más simple de operar y suficiente
 * porque solo necesitamos crear eventos y consultar disponibilidad, no leer datos privados.
 */

import { google } from 'googleapis';

let cachedAuth = null;
let cachedCredentials = null;

function loadCredentials() {
  if (cachedCredentials) return cachedCredentials;
  const raw = process.env.GOOGLE_CALENDAR_SA_KEY;
  if (!raw) return null;
  try {
    cachedCredentials = JSON.parse(raw);
  } catch {
    try {
      cachedCredentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    } catch {
      console.error('[googleCalendar] GOOGLE_CALENDAR_SA_KEY no es JSON válido ni base64 de un JSON válido.');
      return null;
    }
  }
  return cachedCredentials;
}

function getAuth() {
  if (cachedAuth) return cachedAuth;
  const credentials = loadCredentials();
  if (!credentials) return null;
  cachedAuth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return cachedAuth;
}

export function getServiceAccountEmail() {
  return loadCredentials()?.client_email || null;
}

export function isConfigured() {
  return !!loadCredentials();
}

// Comprueba que la plataforma tiene acceso real a ese calendario (compartido + permiso correcto).
export async function checkCalendarAccess(calendarId) {
  if (!isConfigured()) {
    return { ok: false, error: 'Google Calendar no está configurado en el servidor (falta GOOGLE_CALENDAR_SA_KEY).' };
  }
  if (!calendarId) {
    return { ok: false, error: 'Falta el Calendar ID.' };
  }
  try {
    const calendar = google.calendar({ version: 'v3', auth: getAuth() });
    const res = await calendar.calendars.get({ calendarId });
    return { ok: true, summary: res.data.summary, timeZone: res.data.timeZone };
  } catch (err) {
    const status = err.code || err.response?.status;
    if (status === 404) {
      return { ok: false, error: 'No se encuentra ese calendario. Revisa que el Calendar ID esté bien copiado.' };
    }
    if (status === 403 || status === 401) {
      return {
        ok: false,
        error: `El calendario no ha sido compartido con la cuenta de servicio (${getServiceAccountEmail() || 'sin configurar'}), o falta el permiso "Realizar cambios en eventos".`,
      };
    }
    return { ok: false, error: err.message || 'Error desconocido al conectar con Google Calendar.' };
  }
}

// ¿Está libre ese hueco? Si no se puede comprobar (no configurado / error), asume libre para no bloquear la reserva.
export async function isSlotFree(calendarId, startISO, durationMinutes = 30) {
  if (!isConfigured() || !calendarId || !startISO) return true;
  try {
    const calendar = google.calendar({ version: 'v3', auth: getAuth() });
    const start = new Date(startISO);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const res = await calendar.freebusy.query({
      requestBody: { timeMin: start.toISOString(), timeMax: end.toISOString(), items: [{ id: calendarId }] },
    });
    const busy = res.data.calendars?.[calendarId]?.busy || [];
    return busy.length === 0;
  } catch (err) {
    console.error('[googleCalendar] isSlotFree error:', err.message);
    return true;
  }
}

// Crea el evento real en el calendario del tenant. No invita al cliente por email (sendUpdates: 'none')
// para no mandarle una notificación de Google inesperada desde una cuenta de servicio desconocida —
// el aviso al dueño del negocio ya lo hace notifyOwnerAccion() por su cuenta.
export async function createCalendarEvent(calendarId, { summary, description, startISO, durationMinutes = 30 }) {
  if (!isConfigured()) throw new Error('Google Calendar no está configurado en el servidor.');
  const calendar = google.calendar({ version: 'v3', auth: getAuth() });
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const res = await calendar.events.insert({
    calendarId,
    sendUpdates: 'none',
    requestBody: {
      summary,
      description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    },
  });
  return res.data;
}

// Mueve/actualiza un evento existente (cambio de fecha, hora o datos de la reserva).
// Sólo se envían los campos indicados — usa PATCH, no PUT, para no borrar lo que no tocamos.
export async function updateCalendarEvent(calendarId, eventId, { summary, description, startISO, durationMinutes = 30 } = {}) {
  if (!isConfigured()) throw new Error('Google Calendar no está configurado en el servidor.');
  const calendar = google.calendar({ version: 'v3', auth: getAuth() });
  const body = {};
  if (summary !== undefined)     body.summary = summary;
  if (description !== undefined) body.description = description;
  if (startISO) {
    const start = new Date(startISO);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    body.start = { dateTime: start.toISOString() };
    body.end   = { dateTime: end.toISOString() };
  }
  const res = await calendar.events.patch({
    calendarId, eventId, sendUpdates: 'none', requestBody: body,
  });
  return res.data;
}

// Borra el evento al cancelar una reserva. Un 404/410 (ya no existe) NO es un error
// para nosotros: el estado deseado —que no haya evento— ya se cumple.
export async function deleteCalendarEvent(calendarId, eventId) {
  if (!isConfigured()) throw new Error('Google Calendar no está configurado en el servidor.');
  const calendar = google.calendar({ version: 'v3', auth: getAuth() });
  try {
    await calendar.events.delete({ calendarId, eventId, sendUpdates: 'none' });
    return true;
  } catch (err) {
    const code = err?.code || err?.response?.status;
    if (code === 404 || code === 410) return true;
    throw err;
  }
}
