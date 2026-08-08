-- 025_aforo_recurso.sql
-- Aforo por sede.
--
-- Hasta ahora la capacidad vivía en dos sitios y ninguno servía del todo:
--   · `reservas_franjas.capacidad`, que es por franja horaria — sirve para el
--     motor de reservas propio, no para "en esta sede caben 30".
--   · `project_tools.config.plazas_carretillero`, un número global metido en la
--     configuración de un cliente concreto: el mismo aforo para todas sus sedes,
--     y sin forma de cambiarlo desde el panel.
--
-- Va como columna y no dentro de `metadata` porque es un dato del negocio, con
-- su tipo y su restricción, no pegamento de integración como los alias.

ALTER TABLE public.reservas_recursos
  ADD COLUMN IF NOT EXISTS aforo INTEGER CHECK (aforo IS NULL OR aforo > 0);

COMMENT ON COLUMN public.reservas_recursos.aforo IS
  'Plazas totales de la sede. NULL = sin límite conocido; el flujo del cliente decide qué hacer.';
