-- Migration 015: arregla la 014, que no funcionaba.
--
-- CAUSA: la política de la 014 sobre `proyectos` hace un subquery contra
-- `proyecto_operadores`. Las expresiones de una política RLS se evalúan CON LOS PERMISOS
-- DEL USUARIO QUE CONSULTA, no del dueño de la política — y `proyecto_operadores` tiene
-- RLS con una única política para service_role (migración 013). Resultado: para un usuario
-- `authenticated` ese subquery devuelve 0 filas siempre, la política evalúa a falso, y el
-- Editor seguía diciendo "Proyecto no encontrado" aunque el vínculo existiera en la tabla.
--
-- Por eso el Dashboard SÍ mostraba el proyecto (va por el backend con service_role, que
-- ignora RLS) y el Editor NO (consulta `proyectos` directo desde el navegador).
--
-- FIX: permitir que cada usuario lea SUS PROPIAS filas de proyecto_operadores. Es
-- información suya (a qué proyectos tiene acceso), no hay filtración: no puede ver los
-- vínculos de otras personas ni de proyectos ajenos.

DROP POLICY IF EXISTS "usuario_lee_sus_vinculos" ON proyecto_operadores;
CREATE POLICY "usuario_lee_sus_vinculos" ON proyecto_operadores
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
