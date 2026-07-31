-- Migration 012: notas internas por conversación (nunca visibles para el cliente).
--
-- Es un histórico, no un campo único que se pisen entre sí varias operadoras: cada nota
-- guarda quién la escribió y cuándo, para que quien abra el chat después tenga contexto.
--
-- Idempotente: se puede ejecutar varias veces sin error.

CREATE TABLE IF NOT EXISTS conversacion_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- La conversación se identifica igual que en el resto del código: proyecto + canal + visitor
  -- (no hay tabla de conversaciones con PK propia para todos los canales).
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  canal TEXT NOT NULL,
  visitor_id TEXT NOT NULL,

  -- Autor: si el usuario se borra, la nota se conserva con el nombre ya guardado.
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nombre TEXT,
  contenido TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversacion_notas_lookup
  ON conversacion_notas(proyecto_id, canal, visitor_id, created_at DESC);

-- Solo service_role: el frontend nunca lee esta tabla directamente, todo pasa por el backend
-- (/api/conversations/:id/notas), que valida que el proyecto sea del usuario autenticado.
ALTER TABLE conversacion_notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_conversacion_notas" ON conversacion_notas;
CREATE POLICY "service_role_conversacion_notas" ON conversacion_notas
  FOR ALL TO service_role USING (true) WITH CHECK (true);
