/**
 * actionsService.js — Calls n8n webhook for action tool execution.
 * Each project can have its own set of enabled tools (project_tools table).
 */

const TIMEOUT_MS = 10_000;

// Map internal action names → n8n tipo values
const ACTION_TO_TIPO = {
  concertar_cita:  'cita',
  capturar_pedido: 'pedido',
  consultar_stock: 'info',
  custom:          'notificacion',
};

// Normalize payload fields to the datos.* schema expected by n8n
function buildDatos(action, payload) {
  switch (action) {
    case 'concertar_cita':
      return {
        nombre_cliente:    payload.nombre        || '',
        telefono_cliente:  payload.telefono      || '',
        email_cliente:     payload.email         || '',
        fecha_cita:        payload.fecha_preferida || '',
        motivo:            payload.motivo        || '',
      };
    case 'capturar_pedido':
      return {
        nombre_cliente:    payload.nombre        || '',
        telefono_cliente:  payload.telefono      || '',
        email_cliente:     payload.email         || '',
        productos:         payload.productos     || '',
        cantidad:          '',
        observaciones:     payload.notas || payload.direccion || '',
      };
    case 'consultar_stock':
      return {
        referencia:        payload.referencia    || '',
        nombre:            payload.nombre        || '',
      };
    default:
      return payload;
  }
}

/**
 * Sends an action call to the configured n8n webhook.
 *
 * @param {string} projectId      - Project UUID
 * @param {string} action         - Tool name (e.g. 'concertar_cita')
 * @param {object} payload        - Tool input from Claude
 * @param {object} toolConfig     - Tool-specific config from project_tools.config
 * @param {object} projectContext - { nombre, ycloud_api_key, ycloud_phone_number, visitor_id, canal, customer_id, reply_webhook_url }
 */
export async function callActionWebhook(projectId, action, payload, toolConfig = {}, projectContext = {}) {
  // La del proyecto manda; la global queda de respaldo. Así un cliente puede
  // tener su propio n8n —y su propio destino de almacenamiento— sin que haya que
  // tocar el workflow compartido, donde un fallo los afecta a todos.
  const webhookUrl = projectContext.webhook_url || process.env.N8N_ACTIONS_WEBHOOK_URL;
  const token      = process.env.N8N_WEBHOOK_TOKEN;

  if (!webhookUrl) {
    console.warn('[actions] N8N_ACTIONS_WEBHOOK_URL not configured — skipping action:', action);
    return { ok: false, mensaje: 'El servicio de acciones no está configurado.' };
  }

  const body = {
    project_id:      projectId,
    tipo:            ACTION_TO_TIPO[action] || action,
    proyecto_nombre: projectContext.nombre || '',
    ycloud_api_key:  projectContext.ycloud_api_key || '',
    ycloud_from:     projectContext.ycloud_phone_number || '',
    tool_config:     toolConfig,
    datos:           buildDatos(action, payload),
    visitor_id:      projectContext.visitor_id || '',
    canal:           projectContext.canal || '',
    customer_id:     projectContext.customer_id || '',
    reply_webhook_url: projectContext.reply_webhook_url || '',
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`n8n webhook ${res.status}: ${text}`);
    }

    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[actions] Webhook timeout for action:', action);
      return { ok: false, mensaje: 'La acción tardó demasiado en responder. Inténtalo de nuevo.' };
    }
    console.error('[actions] Webhook error:', err.message);
    return { ok: false, mensaje: 'Error al ejecutar la acción. Por favor, inténtalo de nuevo.' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loads enabled tools for a project from Supabase.
 * Returns { enabledNames: string[], configs: Record<string, object> }
 */
export async function loadProjectTools(supabase, projectId) {
  const { data, error } = await supabase
    .from('project_tools')
    .select('tool_name, config')
    .eq('project_id', projectId)
    .eq('enabled', true);

  if (error || !data) return { enabledNames: [], configs: {} };

  const enabledNames = data.map(r => r.tool_name);
  const configs = Object.fromEntries(data.map(r => [r.tool_name, r.config || {}]));

  // Las sedes se guardan como RECURSOS, que es la misma cosa —"cada sede, local
  // o sala"— y ya tienen editor en el panel. Se inyectan en la config de
  // `custom` porque es lo que viaja al webhook de n8n y lo que alimenta el enum
  // de la herramienta: quien las consume no tiene que saber de dónde salen.
  const sedes = await cargarSedes(supabase, projectId);
  if (sedes.length) configs.custom = { ...(configs.custom || {}), sedes };

  return { enabledNames, configs };
}

/**
 * Recursos del proyecto, en la forma que espera el resto del sistema.
 * `metadata` guarda lo que es propio de la integración de cada cliente: con qué
 * nombre aparece esa sede en sus ficheros.
 */
async function cargarSedes(supabase, projectId) {
  const { data } = await supabase
    .from('reservas_recursos')
    // select('*') a propósito: así una columna añadida después (aforo) llega
    // sola, y el backend no se cae si aún no se ha pasado la migración.
    .select('*')
    .eq('proyecto_id', projectId)
    .eq('activo', true)
    .order('nombre')
    .then(r => r, () => ({ data: null }));

  return (data || []).map(r => ({
    nombre: r.nombre,
    direccion: r.direccion || '',
    alias_calendario: r.metadata?.alias_calendario || [],
    alias_alumnos: r.metadata?.alias_alumnos || r.nombre,
    // Por defecto se puede reservar: lo excepcional es la sede que no.
    reserva_online: r.metadata?.reserva_online !== false,
    aforo: r.aforo ?? null,
  }));
}
