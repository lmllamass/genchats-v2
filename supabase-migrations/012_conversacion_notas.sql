-- 012_conversacion_notas.sql
-- Notas internas de una conversación del inbox.
--
-- Append-only a propósito: con varios agentes atendiendo, un campo de texto único hace que
-- el segundo agente pise lo que escribió el primero sin enterarse. Apilando notas queda
-- historial, autor y hora.
--
-- Identidad de conversación = (proyecto_id, visitor_id, canal), NO conversaciones.id:
-- la fila de `conversaciones` solo se crea al activar el takeover humano, así que una
-- conversación que nunca se ha intervenido no tiene id al que referenciar.

CREATE TABLE IF NOT EXISTS conversacion_notas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id  UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  visitor_id   TEXT NOT NULL,
  canal        TEXT NOT NULL,
  autor_id     UUID,
  autor_nombre TEXT,
  contenido    TEXT NOT NULL CHECK (length(trim(contenido)) > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversacion_notas_conv
  ON conversacion_notas (proyecto_id, visitor_id, canal, created_at DESC);

ALTER TABLE conversacion_notas ENABLE ROW LEVEL SECURITY;

-- Solo service_role: el frontend nunca lee esta tabla directamente, siempre pasa por el
-- backend, que valida que el proyecto sea del usuario autenticado.
DROP POLICY IF EXISTS "service_role_conversacion_notas" ON conversacion_notas;
CREATE POLICY "service_role_conversacion_notas" ON conversacion_notas
  FOR ALL TO service_role USING (true) WITH CHECK (true);
