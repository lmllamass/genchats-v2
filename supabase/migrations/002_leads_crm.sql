-- Migration 002: Mini CRM Leads
-- Run in Supabase SQL Editor before deploying.

-- Add new columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_sent_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Lead message log (outbound WhatsApp messages sent to leads)
CREATE TABLE IF NOT EXISTS lead_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by TEXT,
  direction TEXT DEFAULT 'outbound',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_messages_lead_id ON lead_messages(lead_id);

ALTER TABLE lead_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON lead_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Message templates per user
CREATE TABLE IF NOT EXISTS lead_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_templates_user_id ON lead_templates(user_id);

ALTER TABLE lead_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON lead_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
