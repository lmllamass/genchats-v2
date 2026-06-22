import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'https://api-v2.genchats.app';

async function apiFetch(path, options = {}) {
  // Destructure `headers` separately so that ...restOptions doesn't override the
  // merged headers object below (last-key-wins in object literals).
  const { timeout = 30000, signal: externalSignal, headers: extraHeaders, ...restOptions } = options;
  // Abort after `timeout` ms — prevents infinite hangs (e.g., in iframe or slow networks)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Request timeout', 'TimeoutError')), timeout);
  const signal = externalSignal || controller.signal;

  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      signal,
      ...restOptions,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function apiFetchAuth(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return apiFetch(path, {
    ...options,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
}

export const api = {
  scrape: (url) =>
    apiFetch('/api/scrape', { method: 'POST', body: JSON.stringify({ url }), timeout: 90000 }),

  generarChatbot: (proyecto_id) =>
    apiFetch('/api/generar-chatbot', { method: 'POST', body: JSON.stringify({ proyecto_id }) }),

  generarPagina: (proyecto_id) =>
    apiFetch('/api/generar-pagina', { method: 'POST', body: JSON.stringify({ proyecto_id }) }),

  chatbotRespond: (data) =>
    apiFetch('/api/chatbot/respond', { method: 'POST', body: JSON.stringify(data) }),

  publicChatbotConfig: (proyecto_id) =>
    apiFetch(`/api/chatbot-public/${proyecto_id}/config`),

  publicChatbotMessage: (proyecto_id, data) =>
    apiFetch(`/api/chatbot-public/${proyecto_id}/message`, { method: 'POST', body: JSON.stringify(data), timeout: 60000 }),

  stripeCheckout: (data) =>
    apiFetch('/api/stripe/checkout', { method: 'POST', body: JSON.stringify(data) }),

  stripeVerifySession: (sessionId) =>
    apiFetch(`/api/stripe/verify-session/${sessionId}`),

  stripePortal: (data) =>
    apiFetch('/api/stripe/portal', { method: 'POST', body: JSON.stringify(data) }),

  exportar: (data) =>
    apiFetch('/api/exportar', { method: 'POST', body: JSON.stringify(data) }),

  registrarWebhook: (data) =>
    apiFetch('/api/ycloud-config/registrar-webhook', { method: 'POST', body: JSON.stringify(data) }),

  enviarMensajePrueba: (data) =>
    apiFetch('/api/ycloud-config/enviar-mensaje-prueba', { method: 'POST', body: JSON.stringify(data) }),

  activarYcloud: (data) =>
    apiFetch('/api/ycloud-config/activar', { method: 'POST', body: JSON.stringify(data) }),

  adminGetConfig: () =>
    apiFetchAuth('/api/admin/config'),

  adminUpdateConfig: (data) =>
    apiFetchAuth('/api/admin/config', { method: 'PUT', body: JSON.stringify(data) }),

  // Returns merged auth+profile data using service role (bypasses RLS)
  adminGetUsuarios: () =>
    apiFetchAuth('/api/admin/usuarios'),

  // Update a user's profile via backend (service role bypasses RLS)
  adminUpdateUsuario: (id, data) =>
    apiFetchAuth(`/api/admin/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  adminInviteUser: (email) =>
    apiFetchAuth('/api/admin/invitar', { method: 'POST', body: JSON.stringify({ email }) }),

  adminTelegramRegisterWebhook: (proyecto_id) =>
    apiFetchAuth('/api/admin/telegram/registrar-webhook', { method: 'POST', body: JSON.stringify({ proyecto_id }) }),

  // Update any project bypassing RLS (admin only, uses service role)
  adminUpdateProyecto: (id, data) =>
    apiFetchAuth(`/api/admin/proyectos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  genaMessage: (data) =>
    apiFetch('/api/gena/message', { method: 'POST', body: JSON.stringify(data), timeout: 30000 }),

  notifyLead: (data) =>
    apiFetch('/api/notify/lead', { method: 'POST', body: JSON.stringify(data) }),

  notifyProActivation: (data) =>
    apiFetch('/api/notify/pro-activation', { method: 'POST', body: JSON.stringify(data) }),

  notifyWhatsAppRequest: (data) =>
    apiFetch('/api/notify/whatsapp-request', { method: 'POST', body: JSON.stringify(data) }),

  notifyRetellRequest: (data) =>
    apiFetch('/api/notify/retell-request', { method: 'POST', body: JSON.stringify(data) }),

  // Project Tools (Actions Engine) — admin only
  adminGetProjectTools: (projectId) =>
    apiFetchAuth(`/api/admin/proyectos/${projectId}/tools`),

  adminUpsertProjectTool: (projectId, data) =>
    apiFetchAuth(`/api/admin/proyectos/${projectId}/tools`, { method: 'POST', body: JSON.stringify(data) }),

  adminUpdateProjectTool: (projectId, toolId, data) =>
    apiFetchAuth(`/api/admin/proyectos/${projectId}/tools/${toolId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  adminDeleteProjectTool: (projectId, toolId) =>
    apiFetchAuth(`/api/admin/proyectos/${projectId}/tools/${toolId}`, { method: 'DELETE' }),

  // Conversations inbox
  listConversations: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString();
    return apiFetchAuth(`/api/conversations${q ? '?' + q : ''}`);
  },
  getMessages: (convId, params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString();
    return apiFetchAuth(`/api/conversations/${convId}/messages${q ? '?' + q : ''}`);
  },
  setTakeover: (convId, human_takeover) =>
    apiFetchAuth(`/api/conversations/${convId}/takeover`, { method: 'PATCH', body: JSON.stringify({ human_takeover }) }),
  sendConversationMessage: (convId, text) =>
    apiFetchAuth(`/api/conversations/${convId}/message`, { method: 'POST', body: JSON.stringify({ text }) }),

  // Leads CRM
  listLeads: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))).toString();
    return apiFetchAuth(`/api/leads${q ? '?' + q : ''}`);
  },
  getLead: (id) => apiFetchAuth(`/api/leads/${id}`),
  updateLead: (id, data) =>
    apiFetchAuth(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  sendLeadWhatsApp: (id, message) =>
    apiFetchAuth(`/api/leads/${id}/whatsapp`, { method: 'POST', body: JSON.stringify({ message }) }),
  listLeadTemplates: () => apiFetchAuth('/api/leads/templates'),
  createLeadTemplate: (data) =>
    apiFetchAuth('/api/leads/templates', { method: 'POST', body: JSON.stringify(data) }),
  deleteLeadTemplate: (id) =>
    apiFetchAuth(`/api/leads/templates/${id}`, { method: 'DELETE' }),
};
