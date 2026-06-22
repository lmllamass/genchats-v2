-- Migration 000: user profiles
--
-- Base profile table used by auth, admin, plans and Stripe integration.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user','admin')),
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo','inactivo','bloqueado')),

  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','pro','super_pro')),
  trial_ends_at TIMESTAMPTZ,
  plan_activated_at TIMESTAMPTZ,
  mensajes_usados_mes INTEGER DEFAULT 0,

  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  telefono TEXT,
  empresa TEXT,
  direccion TEXT,
  notas_admin TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan ON user_profiles(plan);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON user_profiles;
CREATE TRIGGER set_updated_at_user_profiles
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_profile" ON user_profiles;
CREATE POLICY "users_own_profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
CREATE POLICY "users_insert_own_profile" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "service_role_user_profiles" ON user_profiles;
CREATE POLICY "service_role_user_profiles" ON user_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

