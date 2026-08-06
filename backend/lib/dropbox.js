/**
 * Cliente mínimo de Dropbox para el backend.
 *
 * La credencial de Dropbox vive dentro de n8n y desde aquí no es accesible, así
 * que el backend tiene la suya (app key/secret + refresh token de larga
 * duración). Los access token de Dropbox caducan a las 4 h: se renuevan solos y
 * se cachean en memoria mientras el proceso viva.
 */

// Sobreescribibles para poder levantar un Dropbox de mentira en las pruebas sin
// tocar la lógica ni necesitar credenciales reales.
const API = process.env.DROPBOX_API_BASE || 'https://api.dropboxapi.com';
const CONTENT = process.env.DROPBOX_CONTENT_BASE || 'https://content.dropboxapi.com';

let cache = { token: null, expira: 0 };

async function accessToken() {
  if (cache.token && Date.now() < cache.expira - 60_000) return cache.token;

  const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN } = process.env;
  if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN) {
    throw new Error('Faltan credenciales de Dropbox en el backend (DROPBOX_APP_KEY/SECRET/REFRESH_TOKEN)');
  }

  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: DROPBOX_REFRESH_TOKEN }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Dropbox oauth: ${data.error_description || JSON.stringify(data)}`);

  cache = { token: data.access_token, expira: Date.now() + (data.expires_in || 14400) * 1000 };
  return cache.token;
}

/**
 * La cabecera Dropbox-API-Arg tiene que ser ASCII puro: un acento en la ruta
 * (p. ej. /Documentación/) devuelve un 400 críptico. Se escapan como \uXXXX.
 */
function apiArg(obj) {
  return JSON.stringify(obj).replace(/[\u007f-\uffff]/g, c =>
    '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export async function subirFichero(ruta, buffer, { mode = 'overwrite' } = {}) {
  const res = await fetch(`${CONTENT}/2/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': apiArg({ path: ruta, mode, autorename: false, mute: true }),
    },
    body: buffer,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Dropbox upload ${ruta}: ${data.error_summary || res.status}`);
  return data;
}

/** Contenido de una carpeta. Si no existe devuelve [] en vez de reventar. */
export async function listarCarpeta(ruta) {
  const res = await fetch(`${API}/2/files/list_folder`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: ruta, recursive: false }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.error_summary?.startsWith('path/not_found')) return [];
    throw new Error(`Dropbox list ${ruta}: ${data.error_summary || res.status}`);
  }
  return data.entries || [];
}
