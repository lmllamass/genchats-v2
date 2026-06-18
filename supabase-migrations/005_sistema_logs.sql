-- migrations/005_sistema_logs.sql
-- Tabla de logs del sistema para diagnóstico de errores en producción

CREATE TABLE IF NOT EXISTS system_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  nivel       TEXT        NOT NULL DEFAULT 'info'
                CHECK (nivel IN ('debug','info','warn','error','fatal')),
  servicio    TEXT        NOT NULL,     -- 'backend', 'voice-queue', 'stripe', etc.
  mensaje     TEXT        NOT NULL,
  datos       JSONB       DEFAULT '{}', -- contexto adicional (proyecto_id, user_id, etc.)
  stack_trace TEXT                      -- solo para nivel error/fatal
);

-- Solo lectura para anon (admin puede ver desde Studio)
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_logs" ON system_logs USING (true);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_logs_created_at  ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_nivel        ON system_logs(nivel);
CREATE INDEX IF NOT EXISTS idx_logs_servicio     ON system_logs(servicio);
