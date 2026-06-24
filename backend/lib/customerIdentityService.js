function nowIso() {
  return new Date().toISOString();
}

export function normalizePhone(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  return raw.startsWith('+') ? `+${digits}` : digits;
}

export function normalizeEmail(value) {
  if (!value) return null;
  const email = String(value).trim().toLowerCase();
  return email.includes('@') ? email : null;
}

function normalizeGeneric(value) {
  if (!value) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeSourceChannel(channel) {
  if (!channel) return null;
  return channel === 'embed' ? 'web' : channel;
}

function normalizeIdentity(type, value) {
  if (['phone', 'whatsapp_number', 'retell_phone_number'].includes(type)) return normalizePhone(value);
  if (type === 'email') return normalizeEmail(value);
  return normalizeGeneric(value);
}

function compactIdentities(identities = []) {
  const seen = new Set();
  const normalized = [];

  for (const identity of identities) {
    const identity_type = identity.identity_type || identity.type;
    const identity_value = identity.identity_value || identity.value;
    const normalized_value = normalizeIdentity(identity_type, identity_value);
    if (!identity_type || !identity_value || !normalized_value) continue;

    const key = `${identity_type}:${normalized_value}`;
    if (seen.has(key)) continue;
    seen.add(key);

    normalized.push({
      identity_type,
      identity_value: String(identity_value),
      normalized_value,
      confidence: identity.confidence || 'medium',
      verified: identity.verified ?? false,
      source_channel: normalizeSourceChannel(identity.source_channel || identity.channel),
      metadata: identity.metadata || {},
    });
  }

  return normalized;
}

function primaryFromIdentities(identities, type) {
  return identities.find(i => i.identity_type === type)?.normalized_value || null;
}

export async function resolveCustomerIdentity(supabase, {
  proyecto,
  channel,
  threadId,
  legacyVisitorId,
  identities = [],
  traits = {},
  metadata = {},
}) {
  const proyectoId = proyecto.id;
  const cleanIdentities = compactIdentities(identities);

  let existingIdentities = [];
  for (const identity of cleanIdentities) {
    const { data } = await supabase
      .from('customer_identities')
      .select('*, customers(*)')
      .eq('proyecto_id', proyectoId)
      .eq('identity_type', identity.identity_type)
      .eq('normalized_value', identity.normalized_value);
    existingIdentities.push(...(data || []));
  }

  let customer = existingIdentities.find(i => i.customers)?.customers || null;

  if (!customer) {
    const primaryEmail = normalizeEmail(traits.email) || primaryFromIdentities(cleanIdentities, 'email');
    const primaryPhone = normalizePhone(traits.phone)
      || primaryFromIdentities(cleanIdentities, 'phone')
      || primaryFromIdentities(cleanIdentities, 'whatsapp_number')
      || primaryFromIdentities(cleanIdentities, 'retell_phone_number');

    const { data, error } = await supabase
      .from('customers')
      .insert({
        proyecto_id: proyectoId,
        user_id: proyecto.user_id || null,
        display_name: traits.name || null,
        primary_email: primaryEmail,
        primary_phone: primaryPhone,
        company: traits.company || null,
        lifecycle_stage: traits.lifecycle_stage || 'visitor',
        preferred_channel: normalizeSourceChannel(channel),
        first_seen_at: nowIso(),
        last_seen_at: nowIso(),
        metadata,
      })
      .select()
      .single();
    if (error) throw error;
    customer = data;
  } else {
    const updates = {
      last_seen_at: nowIso(),
      preferred_channel: customer.preferred_channel || normalizeSourceChannel(channel),
      display_name: customer.display_name || traits.name || null,
      primary_email: customer.primary_email || normalizeEmail(traits.email) || null,
      primary_phone: customer.primary_phone || normalizePhone(traits.phone) || null,
      company: customer.company || traits.company || null,
      metadata: { ...(customer.metadata || {}), last_identity_metadata: metadata },
    };
    const { data } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customer.id)
      .select()
      .single();
    if (data) customer = data;
  }

  for (const identity of cleanIdentities) {
    await supabase
      .from('customer_identities')
      .upsert({
        ...identity,
        customer_id: customer.id,
        proyecto_id: proyectoId,
        source_channel: normalizeSourceChannel(identity.source_channel || channel),
        last_seen_at: nowIso(),
      }, { onConflict: 'proyecto_id,identity_type,normalized_value' })
      .then(null, () => {});
  }

  for (const linked of existingIdentities) {
    if (linked.customer_id && linked.customer_id !== customer.id) {
      await supabase.from('customer_merge_suggestions').upsert({
        proyecto_id: proyectoId,
        source_customer_id: linked.customer_id,
        target_customer_id: customer.id,
        reason: `shared_identity:${linked.identity_type}`,
        confidence: linked.confidence || 'medium',
        metadata: { identity_value: linked.normalized_value },
      }, { onConflict: 'proyecto_id,source_customer_id,target_customer_id,reason' }).then(null, () => {});
    }
  }

  const { data: conversation, error: convError } = await supabase
    .from('customer_conversations')
    .upsert({
      proyecto_id: proyectoId,
      customer_id: customer.id,
      channel,
      channel_thread_id: threadId,
      legacy_visitor_id: legacyVisitorId || threadId,
      last_message_at: nowIso(),
      metadata,
    }, { onConflict: 'proyecto_id,channel,channel_thread_id' })
    .select()
    .single();
  if (convError) throw convError;

  const { data: memory } = await supabase
    .from('customer_memory')
    .select('*')
    .eq('customer_id', customer.id)
    .maybeSingle()
    .then(r => r, () => ({ data: null }));

  return { customer, conversation, memory };
}

export async function recordCustomerMessage(supabase, {
  proyectoId,
  customerId,
  conversationId,
  channel,
  role,
  content,
  providerMessageId,
  legacyMessageId,
  metadata = {},
}) {
  if (!customerId || !conversationId || !content) return null;

  const { data } = await supabase
    .from('customer_messages')
    .insert({
      proyecto_id: proyectoId,
      customer_id: customerId,
      conversation_id: conversationId,
      channel,
      role,
      content,
      provider_message_id: providerMessageId || null,
      legacy_message_id: legacyMessageId || null,
      metadata,
    })
    .select()
    .single()
    .then(r => r, () => ({ data: null }));

  await supabase
    .from('customer_conversations')
    .update({ last_message_at: nowIso() })
    .eq('id', conversationId)
    .then(null, () => {});

  await supabase
    .from('customers')
    .update({ last_seen_at: nowIso() })
    .eq('id', customerId)
    .then(null, () => {});

  return data;
}

export async function loadCustomerHistory(supabase, customerId, currentMessage, limit = 30) {
  if (!customerId) return [];
  const { data } = await supabase
    .from('customer_messages')
    .select('role,content,channel,created_at')
    .eq('customer_id', customerId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: true })
    .limit(limit);

  const messages = [];
  for (const msg of data || []) {
    if (msg.role === 'user' && msg.content === currentMessage && messages.length === (data || []).length - 1) continue;
    messages.push({
      role: msg.role,
      content: msg.channel ? `[${msg.channel}] ${msg.content}` : msg.content,
    });
  }
  return messages.length > 20 ? messages.slice(-20) : messages;
}

export function buildCustomerMemoryPrompt({ customer, memory } = {}) {
  if (!customer) return '';

  const lines = ['\n\nMEMORIA OMNICANAL DEL CLIENTE:'];
  if (customer.display_name) lines.push(`- Nombre conocido: ${customer.display_name}`);
  if (customer.primary_email) lines.push(`- Email conocido: ${customer.primary_email}`);
  if (customer.primary_phone) lines.push(`- Teléfono conocido: ${customer.primary_phone}`);
  if (customer.company) lines.push(`- Empresa: ${customer.company}`);
  if (customer.preferred_channel) lines.push(`- Canal preferido/reciente: ${customer.preferred_channel}`);
  if (memory?.summary) lines.push(`- Resumen: ${memory.summary}`);
  if (memory?.known_facts && Object.keys(memory.known_facts).length) {
    lines.push(`- Datos útiles: ${JSON.stringify(memory.known_facts)}`);
  }
  if (memory?.preferences && Object.keys(memory.preferences).length) {
    lines.push(`- Preferencias: ${JSON.stringify(memory.preferences)}`);
  }
  lines.push('Usa esta memoria para no pedir datos ya conocidos y mantener continuidad entre canales.');
  return lines.join('\n');
}

export async function updateCustomerFromContact(supabase, { customer, proyectoId, channel, contact = {} }) {
  if (!customer?.id) return null;

  const updates = {
    last_contact_at: nowIso(),
    lifecycle_stage: 'lead',
    status: 'lead',
  };
  if (contact.nombre || contact.name) updates.display_name = contact.nombre || contact.name;
  if (contact.email) updates.primary_email = normalizeEmail(contact.email);
  if (contact.telefono || contact.phone) updates.primary_phone = normalizePhone(contact.telefono || contact.phone);
  if (contact.empresa || contact.company) updates.company = contact.empresa || contact.company;
  if (contact.interes || contact.notes) updates.notes = contact.interes || contact.notes;

  Object.keys(updates).forEach(key => updates[key] == null && delete updates[key]);

  const { data } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', customer.id)
    .select()
    .single()
    .then(r => r, () => ({ data: null }));

  const identityPayloads = [
    contact.email && { identity_type: 'email', identity_value: contact.email, confidence: 'high', verified: false },
    (contact.telefono || contact.phone) && { identity_type: 'phone', identity_value: contact.telefono || contact.phone, confidence: 'high', verified: false },
  ].filter(Boolean);

  for (const identity of compactIdentities(identityPayloads)) {
    await supabase.from('customer_identities').upsert({
      ...identity,
      customer_id: customer.id,
      proyecto_id: proyectoId,
      source_channel: normalizeSourceChannel(channel),
      last_seen_at: nowIso(),
    }, { onConflict: 'proyecto_id,identity_type,normalized_value' }).then(null, () => {});
  }

  return data;
}
