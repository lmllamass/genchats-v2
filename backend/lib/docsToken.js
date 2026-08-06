/**
 * Tokens autofirmados para los enlaces de documentación.
 *
 * El enlace que recibe el alumno lleva dentro TODO lo que la página necesita
 * (proyecto, DNI, nombre, curso, caducidad) y se valida solo con la firma HMAC.
 * No se guarda en ninguna tabla a propósito: el cliente de FADECOM exige que no
 * haya base de datos, y de paso un enlace reenviado caduca solo.
 */
import crypto from 'crypto';

function secreto() {
  const s = process.env.DOCS_TOKEN_SECRET;
  if (!s) throw new Error('DOCS_TOKEN_SECRET no está configurado en el backend');
  return s;
}

function firma(datos) {
  return crypto.createHmac('sha256', secreto()).update(datos).digest('base64url');
}

export function firmarToken(payload, diasValidez = 7) {
  const cuerpo = { ...payload, exp: Date.now() + diasValidez * 86400_000 };
  const datos = Buffer.from(JSON.stringify(cuerpo)).toString('base64url');
  return `${datos}.${firma(datos)}`;
}

/** Devuelve el payload, o null si la firma no cuadra o el enlace ha caducado. */
export function verificarToken(token) {
  if (typeof token !== 'string') return null;
  const corte = token.lastIndexOf('.');
  if (corte < 1) return null;

  const datos = token.slice(0, corte);
  const recibida = token.slice(corte + 1);
  const esperada = firma(datos);
  // timingSafeEqual revienta si las longitudes difieren, así que se comprueban
  // antes; con tamaños distintos ya sabemos que no coinciden.
  if (recibida.length !== esperada.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada))) return null;

  let cuerpo;
  try {
    cuerpo = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!cuerpo?.exp || cuerpo.exp < Date.now()) return null;
  return cuerpo;
}
