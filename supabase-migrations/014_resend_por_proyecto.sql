-- 014_resend_por_proyecto.sql
-- Configuración de email saliente por tenant.
--
-- El email al cliente final debe salir del dominio del propio negocio, no de genchats.app:
-- si no, al cliente le llega un correo de un remitente que no reconoce y la tasa de spam
-- se dispara. Eso obliga a verificar el dominio en Resend (registros DNS del negocio).
--
-- Mismo patrón que YCloud: la clave del proyecto manda y, si no hay, se cae a la de
-- plataforma (RESEND_API_KEY del backend).

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS resend_api_key         TEXT,
  ADD COLUMN IF NOT EXISTS email_remitente        TEXT,
  ADD COLUMN IF NOT EXISTS email_remitente_nombre TEXT,
  ADD COLUMN IF NOT EXISTS email_activo           BOOLEAN DEFAULT false;

COMMENT ON COLUMN proyectos.resend_api_key IS
  'API key de Resend del tenant. Si es NULL se usa la de plataforma (RESEND_API_KEY).';
COMMENT ON COLUMN proyectos.email_remitente IS
  'Dirección remitente, en un dominio verificado en Resend. Ej: reservas@negocio.com';
COMMENT ON COLUMN proyectos.email_remitente_nombre IS
  'Nombre visible del remitente. Ej: Autoescuela Ejemplo';
COMMENT ON COLUMN proyectos.email_activo IS
  'Solo con el dominio verificado en Resend. Si está a false, no se envía email al cliente.';
