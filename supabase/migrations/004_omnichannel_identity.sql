-- Migration 004: Genchats V2 omnichannel customer identity
--
-- This migration adds the new V2 identity layer without deleting or replacing
-- the legacy V1 tables. It is safe to apply in a fresh V2 Supabase project.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Keep updated_at columns fresh.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Unified customer profile inside a project.
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  display_name TEXT,
  primary_email TEXT,
  primary_phone TEXT,
  company TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','lead','customer','inactive','blocked')),
  lifecycle_stage TEXT DEFAULT 'unknown' CHECK (lifecycle_stage IN ('unknown','visitor','lead','prospect','customer','repeat_customer')),

  notes TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_channel TEXT CHECK (preferred_channel IN ('web','whatsapp','telegram','phone','email')),

  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_contact_at TIMESTAMPTZ,

  consent_status TEXT DEFAULT 'unknown' CHECK (consent_status IN ('unknown','granted','denied','revoked')),
  consent_source TEXT,
  consent_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_customers_proyecto_id ON customers(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_last_seen_at ON customers(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_primary_email ON customers(LOWER(primary_email));
CREATE INDEX IF NOT EXISTS idx_customers_primary_phone ON customers(primary_phone);

DROP TRIGGER IF EXISTS set_updated_at_customers ON customers;
CREATE TRIGGER set_updated_at_customers
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_customers" ON customers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Individual identifiers linked to a unified customer.
CREATE TABLE IF NOT EXISTS customer_identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,

  identity_type TEXT NOT NULL CHECK (
    identity_type IN (
      'phone',
      'email',
      'whatsapp_number',
      'telegram_user_id',
      'telegram_username',
      'web_visitor_id',
      'retell_call_id',
      'retell_phone_number',
      'ip',
      'cookie',
      'external_customer_id'
    )
  ),
  identity_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,

  source_channel TEXT CHECK (source_channel IN ('web','whatsapp','telegram','phone','email','system')),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  verified BOOLEAN DEFAULT FALSE,

  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::JSONB,

  UNIQUE(proyecto_id, identity_type, normalized_value)
);

CREATE INDEX IF NOT EXISTS idx_customer_identities_customer_id ON customer_identities(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_identities_lookup
  ON customer_identities(proyecto_id, identity_type, normalized_value);
CREATE INDEX IF NOT EXISTS idx_customer_identities_confidence ON customer_identities(confidence);

DROP TRIGGER IF EXISTS set_updated_at_customer_identities ON customer_identities;
CREATE TRIGGER set_updated_at_customer_identities
  BEFORE UPDATE ON customer_identities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE customer_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_customer_identities" ON customer_identities
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- One conversation per channel thread, attached to a unified customer.
CREATE TABLE IF NOT EXISTS customer_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  channel TEXT NOT NULL CHECK (channel IN ('web','whatsapp','telegram','phone','email','embed')),
  channel_thread_id TEXT NOT NULL,
  legacy_visitor_id TEXT,

  status TEXT DEFAULT 'open' CHECK (status IN ('open','pending','closed','archived')),
  human_takeover BOOLEAN DEFAULT FALSE,
  human_takeover_at TIMESTAMPTZ,

  first_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::JSONB,

  UNIQUE(proyecto_id, channel, channel_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_conversations_project ON customer_conversations(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_customer_conversations_customer ON customer_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_conversations_last_message
  ON customer_conversations(last_message_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_customer_conversations ON customer_conversations;
CREATE TRIGGER set_updated_at_customer_conversations
  BEFORE UPDATE ON customer_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE customer_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_customer_conversations" ON customer_conversations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Normalized message history for all channels.
CREATE TABLE IF NOT EXISTS customer_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES customer_conversations(id) ON DELETE CASCADE,

  channel TEXT NOT NULL CHECK (channel IN ('web','whatsapp','telegram','phone','email','embed')),
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system','agent','tool')),
  content TEXT NOT NULL,

  provider_message_id TEXT,
  legacy_message_id UUID,
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_customer_messages_conversation
  ON customer_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_messages_customer
  ON customer_messages(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_messages_project
  ON customer_messages(proyecto_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_messages_provider_unique
  ON customer_messages(proyecto_id, channel, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE customer_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_customer_messages" ON customer_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Compact memory used by the AI so it does not need to load every message.
CREATE TABLE IF NOT EXISTS customer_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  summary TEXT,
  known_facts JSONB DEFAULT '{}'::JSONB,
  preferences JSONB DEFAULT '{}'::JSONB,
  ecommerce_profile JSONB DEFAULT '{}'::JSONB,
  last_summarized_message_at TIMESTAMPTZ,

  UNIQUE(customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_memory_project ON customer_memory(proyecto_id);

DROP TRIGGER IF EXISTS set_updated_at_customer_memory ON customer_memory;
CREATE TRIGGER set_updated_at_customer_memory
  BEFORE UPDATE ON customer_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE customer_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_customer_memory" ON customer_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Candidate merges for medium/low confidence identity matches.
CREATE TABLE IF NOT EXISTS customer_merge_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  source_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  target_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  reason TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','ignored')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::JSONB,

  CHECK (source_customer_id <> target_customer_id),
  UNIQUE(proyecto_id, source_customer_id, target_customer_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_customer_merge_suggestions_project
  ON customer_merge_suggestions(proyecto_id, status, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_customer_merge_suggestions ON customer_merge_suggestions;
CREATE TRIGGER set_updated_at_customer_merge_suggestions
  BEFORE UPDATE ON customer_merge_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE customer_merge_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_customer_merge_suggestions" ON customer_merge_suggestions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Future V3 hook: ecommerce/navigation events can attach to the same customer.
CREATE TABLE IF NOT EXISTS customer_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES customer_conversations(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL,
  channel TEXT CHECK (channel IN ('web','whatsapp','telegram','phone','email','embed','system')),
  session_id TEXT,
  url TEXT,
  product_id TEXT,
  product_sku TEXT,
  value NUMERIC,
  currency TEXT,
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_customer_events_project_time
  ON customer_events(proyecto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_events_customer_time
  ON customer_events(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_events_type ON customer_events(event_type);

ALTER TABLE customer_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_customer_events" ON customer_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
