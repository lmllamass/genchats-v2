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
