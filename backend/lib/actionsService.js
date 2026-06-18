/**
 * actionsService.js — Calls n8n webhook for action tool execution.
 * Each project can have its own set of enabled tools (project_tools table).
 */

const TIMEOUT_MS = 10_000;

/**
 * Sends an action call to the configured n8n webhook.
 *
 * @param {string} projectId  - Project UUID (multitenant routing key for n8n)
 * @param {string} action     - Tool name (e.g. 'concertar_cita')
 * @param {object} payload    - Tool input from Claude
 * @param {object} toolConfig - Tool-specific config from project_tools.config
 * @returns {Promise<object>} - n8n response (should have { ok, mensaje, ... })
 */
export async function callActionWebhook(projectId, action, payload, toolConfig = {}) {
  const webhookUrl = process.env.N8N_ACTIONS_WEBHOOK_URL;
  const token      = process.env.N8N_WEBHOOK_TOKEN;

  if (!webhookUrl) {
    console.warn('[actions] N8N_ACTIONS_WEBHOOK_URL not configured — skipping action:', action);
    return { ok: false, mensaje: 'El servicio de acciones no está configurado.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ projectId, action, payload, tools_config: toolConfig }),
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
  return { enabledNames, configs };
}
