-- Migration 013: varias operadoras atendiendo el mismo proyecto (bandeja compartida).
--
-- Hasta ahora el modelo era "1 proyecto = 1 usuario dueño" (proyectos.user_id). Fadecom
-- necesita 8+ operadoras sobre el mismo WhatsApp, así que se añade una tabla de vínculos.
-- El dueño (proyectos.user_id) NO se toca: sigue siendo quien paga y configura. Las
-- operadoras solo acceden a la operativa (conversaciones, leads, notas), no a facturación
-- ni a la configuración del chatbot.
--
-- Idempotente: se puede ejecutar varias veces sin error.

CREATE TABLE IF NOT EXISTS proyecto_operadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 'operador': atiende conversaciones y leads.
  -- 'supervisor': igual + puede gestionar el alta/baja de otras operadoras.
  rol TEXT NOT NULL DEFAULT 'operador' CHECK (rol IN ('operador', 'supervisor')),

  -- Traza de quién dio el alta, para auditoría.
  invitado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  nombre TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,

  UNIQUE(proyecto_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_proyecto_operadores_user ON proyecto_operadores(user_id) WHERE activo;
CREATE INDEX IF NOT EXISTS idx_proyecto_operadores_proyecto ON proyecto_operadores(proyecto_id);

-- Solo service_role: el frontend nunca lee esta tabla directamente. Todo el control de
-- acceso vive en el backend (backend/lib/projectAccess.js), que es donde se resuelve
-- "este usuario es dueño O es operadora activa de este proyecto".
ALTER TABLE proyecto_operadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_proyecto_operadores" ON proyecto_operadores;
CREATE POLICY "service_role_proyecto_operadores" ON proyecto_operadores
  FOR ALL TO service_role USING (true) WITH CHECK (true);
