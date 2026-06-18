-- Migration 001: conversaciones metadata table
-- Run this in the Supabase SQL editor before deploying the inbox feature.

CREATE TABLE IF NOT EXISTS conversaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID NOT NULL,
  visitor_id TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  human_takeover BOOLEAN DEFAULT false,
  human_takeover_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(proyecto_id, visitor_id, canal)
);

CREATE INDEX IF NOT EXISTS idx_conversaciones_proyecto_id ON conversaciones(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_last_msg ON conversaciones(last_message_at DESC);

ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON conversaciones
  FOR ALL TO service_role USING (true) WITH CHECK (true);
