-- ============================================================
-- MIGRATION 002: Add extra columns to user_profiles
-- Needed by UserEditDialog (telefono, empresa, direccion,
-- notas_admin) and plan promotion (plan_activated_at).
-- Run this in Supabase Studio → SQL Editor
-- ============================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS telefono          TEXT,
  ADD COLUMN IF NOT EXISTS empresa           TEXT,
  ADD COLUMN IF NOT EXISTS direccion         TEXT,
  ADD COLUMN IF NOT EXISTS notas_admin       TEXT,
  ADD COLUMN IF NOT EXISTS plan_activated_at TIMESTAMPTZ;
