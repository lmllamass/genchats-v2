-- ═══════════════════════════════════════════════════════════════════════════
-- PUESTA AL DÍA DE v2  ·  8 de agosto de 2026
--
-- v2 ya tiene la 024 aplicada. Le faltan estas dos:
--
--   023 · retell_api_key por proyecto — nunca se llegó a pasar en v2. Hoy no
--         estorba (Retell funciona igual), pero la sección de Retell del admin
--         falla al leer esa columna.
--   025 · aforo por sede
--
-- Con esto, v1 y v2 quedan con el mismo esquema.
-- Reejecutable: si algo ya estuviera, no da error.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 023 ──────────────────────────────────────────────────────────────────

-- 023_retell_api_key_por_proyecto.sql
-- API key de Retell por tenant, mismo patrón que ycloud_api_key / resend_api_key.
--
-- Cada cliente tiene su propia cuenta de Retell (el agente de Fadecom vive en la de
-- rmartinez@fadecom.es, no en la de plataforma). Sin su key guardada, cualquier ajuste
-- del agente (denoising, speech_normalization, interruption_sensitivity…) hay que
-- hacerlo a mano en su dashboard: no se puede automatizar ni asistir por API.
--
-- La lee solo el backend con service_role; nunca debe viajar al frontend más allá del
-- formulario de admin donde se pega.

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS retell_api_key TEXT;

COMMENT ON COLUMN proyectos.retell_api_key IS
  'API key de la cuenta Retell del tenant. NULL si el agente vive en la cuenta de plataforma.';


-- ─── 025 ──────────────────────────────────────────────────────────────────

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
