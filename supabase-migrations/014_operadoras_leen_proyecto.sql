-- Migration 014: las operadoras pueden LEER el proyecto que atienden.
--
-- El Editor (src/api/entidades.js Proyecto.get) consulta la tabla `proyectos` directo desde
-- el navegador, sujeto a RLS — no pasa por el backend. La política existente
-- "users_own_proyectos" solo deja ver la fila al dueño (auth.uid() = user_id), así que una
-- operadora recién invitada obtenía "0 filas" -> "Proyecto no encontrado" al abrir el Editor,
-- aunque el backend (conversaciones, leads, etc.) ya la reconocía bien vía proyecto_operadores.
--
-- Es una política de SOLO LECTURA a propósito: la operadora no gana permiso de escritura
-- sobre `proyectos` (guardar la config del chatbot sigue bloqueado por RLS, como debe ser —
-- eso es "propiedad", no "operativa").

DROP POLICY IF EXISTS "operadoras_leen_proyecto" ON proyectos;
CREATE POLICY "operadoras_leen_proyecto" ON proyectos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proyecto_operadores po
      WHERE po.proyecto_id = proyectos.id
        AND po.user_id = auth.uid()
        AND po.activo = true
    )
  );
