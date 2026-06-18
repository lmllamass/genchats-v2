-- ============================================================
-- pagegen-ai — Schema de Supabase
-- Migración desde Base44 entities
-- ============================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- TABLA: proyectos
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyectos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Básicos
  nombre TEXT NOT NULL,
  url_origen TEXT NOT NULL,
  estado TEXT DEFAULT 'scrapeando' CHECK (estado IN ('scrapeando','generando','activo','pausado','pro_activo','inactivo')),
  notas TEXT,

  -- Scraping
  contenido_scrapeado TEXT,
  metadata_scrapeado JSONB DEFAULT '{}',

  -- Diseño
  plantilla_elegida TEXT DEFAULT 'moderna' CHECK (plantilla_elegida IN ('moderna','clasica','minimalista','corporativa','ecommerce')),
  esquema_color TEXT DEFAULT 'azul_profesional' CHECK (esquema_color IN ('azul_profesional','verde_naturaleza','rojo_impacto','oscuro_premium','claro_limpio','naranja_energia')),

  -- Chatbot
  chatbot_config JSONB DEFAULT '{}',
  ecommerce_config JSONB DEFAULT '{}',
  system_prompt TEXT,

  -- WhatsApp / YCloud
  ycloud_api_key TEXT,
  ycloud_account_email TEXT,
  ycloud_waba_id TEXT,
  ycloud_phone_number_id TEXT,
  ycloud_phone_number TEXT,
  whatsapp_activo BOOLEAN DEFAULT false,
  whatsapp_numero_propio BOOLEAN DEFAULT true,
  modo_atencion TEXT DEFAULT 'bot' CHECK (modo_atencion IN ('bot','coexistencia','humano')),

  -- Telegram
  telegram_username TEXT,
  telegram_token TEXT,

  -- Stripe
  stripe_session_id TEXT,

  -- Agente IA
  agent_name TEXT,

  -- Mensajes
  mensajes_mes INTEGER DEFAULT 0,
  limite_mensajes INTEGER DEFAULT 200,
  mensajes_count INTEGER DEFAULT 0,

  -- Onboarding
  onboarding_completado BOOLEAN DEFAULT false
);

-- RLS: cada usuario ve solo sus proyectos
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_proyectos" ON proyectos
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- TABLA: leads
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  visitor_id TEXT,
  nombre TEXT,
  email TEXT,
  telefono TEXT,
  empresa TEXT,
  notas TEXT,
  canal TEXT DEFAULT 'web' CHECK (canal IN ('web','whatsapp','telegram','embed')),
  estado TEXT DEFAULT 'nuevo' CHECK (estado IN ('nuevo','contactado','cualificado','descartado')),
  mensajes_count INTEGER DEFAULT 0,
  ultimo_mensaje TIMESTAMPTZ
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_leads" ON leads USING (true);

-- ─────────────────────────────────────────
-- TABLA: mensajes_wa
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajes_wa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  from_number TEXT,
  to_number TEXT,
  mensaje TEXT,
  respuesta TEXT,
  wamid TEXT UNIQUE,
  estado TEXT DEFAULT 'recibido' CHECK (estado IN ('recibido','enviado','entregado','leido','error'))
);

ALTER TABLE mensajes_wa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_mensajes_wa" ON mensajes_wa USING (true);

-- ─────────────────────────────────────────
-- TABLA: conversaciones_chat
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversaciones_chat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  canal TEXT DEFAULT 'web' CHECK (canal IN ('web','whatsapp','telegram','embed')),
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL
);

ALTER TABLE conversaciones_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_conversaciones" ON conversaciones_chat USING (true);

-- ─────────────────────────────────────────
-- TABLA: config_plataforma (singleton admin)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config_plataforma (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  clave TEXT UNIQUE DEFAULT 'plataforma',

  -- YCloud
  ycloud_api_key TEXT,
  ycloud_webhook_url TEXT,
  ycloud_webhook_id TEXT,
  ycloud_modo TEXT DEFAULT 'manual' CHECK (ycloud_modo IN ('manual','automatico')),

  -- Meta / WhatsApp
  meta_app_id TEXT,
  meta_config_id TEXT,
  meta_solution_id TEXT,
  meta_modo TEXT DEFAULT 'pendiente' CHECK (meta_modo IN ('pendiente','activo')),

  -- OpenAI
  openai_api_key TEXT,
  openai_modelo TEXT DEFAULT 'gpt-4o-mini' CHECK (openai_modelo IN ('gpt-4o-mini','gpt-4o','gpt-3.5-turbo')),

  -- Stripe
  stripe_secret_key TEXT,
  stripe_webhook_secret TEXT,
  stripe_price_id_pro TEXT,
  stripe_price_id_instalacion TEXT,

  -- Resend (email)
  resend_api_key TEXT,
  resend_from_email TEXT DEFAULT 'noreply@pagegen.ai',

  -- Límites
  limite_mensajes_global INTEGER DEFAULT 200,
  notas_admin TEXT
);

-- Solo admin puede ver/editar config_plataforma
ALTER TABLE config_plataforma ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_config" ON config_plataforma USING (true);

-- ─────────────────────────────────────────
-- TABLA: config_global
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config_global (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  clave TEXT UNIQUE DEFAULT 'global',
  limite_mensajes_mes INTEGER DEFAULT 200
);

ALTER TABLE config_global ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_config_global" ON config_global USING (true);

-- ─────────────────────────────────────────
-- ÍNDICES para rendimiento
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_proyectos_user_id ON proyectos(user_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_ycloud_phone ON proyectos(ycloud_phone_number);
CREATE INDEX IF NOT EXISTS idx_leads_proyecto_id ON leads(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_leads_visitor_id ON leads(visitor_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_wa_proyecto ON mensajes_wa(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_wa_wamid ON mensajes_wa(wamid);
CREATE INDEX IF NOT EXISTS idx_conversaciones_proyecto_visitor ON conversaciones_chat(proyecto_id, visitor_id);

-- ─────────────────────────────────────────
-- TRIGGER: updated_at automático
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_proyectos
  BEFORE UPDATE ON proyectos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_config_plataforma
  BEFORE UPDATE ON config_plataforma
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- DATOS INICIALES
-- ─────────────────────────────────────────
INSERT INTO config_global (clave, limite_mensajes_mes)
VALUES ('global', 200)
ON CONFLICT (clave) DO NOTHING;

INSERT INTO config_plataforma (clave)
VALUES ('plataforma')
ON CONFLICT (clave) DO NOTHING;
