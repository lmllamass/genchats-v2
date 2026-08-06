/**
 * Magic links del portal de archivos.
 *
 * El cliente final no tiene cuenta y no debe tenerla: crear usuarios para los
 * clientes de nuestros clientes mata la adopción. Entra por un enlace que
 * caduca y que el tenant puede revocar.
 *
 * En la base solo vive el SHA-256 del token, nunca el token: existe únicamente
 * dentro de la URL que recibe el contacto. Quien se lleve una copia de la base
 * de datos no se lleva los enlaces.
 */
import crypto from 'crypto';

const DIAS_POR_DEFECTO = 7;

function hash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function crearEnlace(supabase, {
  proyectoId,
  customerId,
  permisos = ['subir'],
  slots = [],
  diasValidez = DIAS_POR_DEFECTO,
  creadoPor = null,
  metadata = {},
}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + diasValidez * 86400_000);

  const { data, error } = await supabase
    .from('archivo_enlaces')
    .insert({
      proyecto_id: proyectoId,
      customer_id: customerId,
      token_hash: hash(token),
      permisos,
      slots,
      expira_en: expira.toISOString(),
      creado_por: creadoPor,
      metadata,
    })
    .select('id, expira_en, permisos, slots')
    .single();
  if (error) throw error;

  // El token en claro se devuelve una sola vez, aquí: después ya no hay forma
  // de recuperarlo, solo de revocarlo y emitir otro.
  return { token, enlace: data };
}

/**
 * Devuelve el enlace si el token vale, o null. Un enlace caducado o revocado se
 * trata igual que uno inexistente: nunca se le dice al visitante cuál de las
 * tres cosas es.
 */
export async function resolverEnlace(supabase, token) {
  if (typeof token !== 'string' || token.length < 32) return null;

  const { data } = await supabase
    .from('archivo_enlaces')
    .select('*')
    .eq('token_hash', hash(token))
    .maybeSingle();

  if (!data) return null;
  if (data.revocado_en) return null;
  if (new Date(data.expira_en) < new Date()) return null;
  return data;
}

/** Se registra el uso sin bloquear la petición: es rastro, no control. */
export function anotarUso(supabase, enlaceId) {
  return supabase.rpc('anotar_uso_enlace', { p_enlace_id: enlaceId }).then(null, () => {});
}

export async function revocarEnlace(supabase, { proyectoId, enlaceId }) {
  const { error } = await supabase
    .from('archivo_enlaces')
    .update({ revocado_en: new Date().toISOString() })
    .eq('id', enlaceId)
    .eq('proyecto_id', proyectoId);
  return !error;
}
