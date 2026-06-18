-- migrations/006_retell_voice_fields.sql
-- Añade campos de Retell (voz IA) a la tabla proyectos para plan Super Pro

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS retell_activo       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retell_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS retell_agent_id     TEXT;
