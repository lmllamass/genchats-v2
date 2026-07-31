/**
 * projectAccess.js — quién puede ver/tocar qué proyecto.
 *
 * Antes cada ruta repetía su propio `proyecto.user_id !== req.user.id`. Con operadoras
 * (varias personas sobre el mismo proyecto) esa comprobación pasa a ser "eres el dueño
 * O eres operadora activa", así que vive aquí en un solo sitio.
 *
 * Distinción importante:
 *  · OPERATIVA (conversaciones, leads, notas, export, ver reservas) → dueño y operadoras.
 *  · PROPIEDAD (facturación, configurar el chatbot, alta de operadoras, borrar) → solo dueño.
 * Por eso `projectForUser` exige pasar `ownerOnly: true` de forma explícita donde toca:
 * es más fácil auditar una llamada que recordar una omisión.
 */

import { supabase } from '../server.js';

/** IDs de proyecto donde el usuario es operadora activa (no incluye los que posee). */
export async function operatedProjectIds(userId) {
  const { data } = await supabase
    .from('proyecto_operadores')
    .select('proyecto_id')
    .eq('user_id', userId)
    .eq('activo', true);
  return (data || []).map(r => r.proyecto_id);
}

/**
 * Todos los proyectos a los que el usuario tiene acceso operativo.
 * @returns {Promise<{owned: object[], operated: object[], all: object[], allIds: string[]}>}
 */
export async function accessibleProjects(userId, columns = 'id, nombre, user_id') {
  const { data: owned } = await supabase
    .from('proyectos').select(columns).eq('user_id', userId);

  const operatedIds = await operatedProjectIds(userId);
  let operated = [];
  if (operatedIds.length) {
    const ownedIds = new Set((owned || []).map(p => p.id));
    const toFetch = operatedIds.filter(id => !ownedIds.has(id));   // no duplicar si además es dueño
    if (toFetch.length) {
      const { data } = await supabase.from('proyectos').select(columns).in('id', toFetch);
      operated = data || [];
    }
  }

  const all = [...(owned || []), ...operated];
  return { owned: owned || [], operated, all, allIds: all.map(p => p.id) };
}

/**
 * Devuelve el proyecto si el usuario puede acceder, o null.
 * @param {object} opts
 * @param {boolean} opts.ownerOnly - true para acciones reservadas al dueño (facturación, config).
 * @param {string}  opts.columns   - columnas a traer (algunas rutas necesitan las claves de YCloud).
 */
export async function projectForUser(proyectoId, userId, opts = {}) {
  const { ownerOnly = false, columns = 'id, nombre, user_id' } = opts;
  if (!proyectoId) return null;

  const { data: proyecto } = await supabase
    .from('proyectos').select(columns).eq('id', proyectoId).single();
  if (!proyecto) return null;

  if (proyecto.user_id === userId) return proyecto;
  if (ownerOnly) return null;

  const { data: op } = await supabase
    .from('proyecto_operadores')
    .select('id, rol')
    .eq('proyecto_id', proyectoId)
    .eq('user_id', userId)
    .eq('activo', true)
    .maybeSingle()
    .then(r => r, () => ({ data: null }));

  return op ? { ...proyecto, _rol: op.rol } : null;
}

/** ¿Puede gestionar el alta/baja de operadoras? Dueño o supervisor. */
export async function canManageOperators(proyectoId, userId) {
  const proyecto = await projectForUser(proyectoId, userId);
  if (!proyecto) return false;
  return proyecto.user_id === userId || proyecto._rol === 'supervisor';
}

/**
 * ¿Es este usuario "solo operadora"? (no posee ningún proyecto pero atiende alguno)
 * El frontend lo usa para no mostrarle planes, trial ni "Nuevo chatbot": no es su cuenta.
 */
export async function isOperatorOnly(userId) {
  const { count } = await supabase
    .from('proyectos').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if (count > 0) return false;
  const operated = await operatedProjectIds(userId);
  return operated.length > 0;
}
