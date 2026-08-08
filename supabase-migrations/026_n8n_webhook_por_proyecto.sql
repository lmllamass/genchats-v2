-- 026_n8n_webhook_por_proyecto.sql
-- Webhook de automatizaciones por proyecto.
--
-- Hasta ahora había UNO global (`N8N_ACTIONS_WEBHOOK_URL`) y todos los clientes
-- entraban por él; dentro, un Switch enrutaba por project_id. Eso trae dos
-- problemas que ya hemos sufrido:
--   · un fallo en ese workflow afecta a todos los tenants a la vez;
--   · no se puede dar a un cliente su propio n8n, ni cambiarle el destino de
--     almacenamiento (Dropbox, Drive, lo que sea) sin tocar el compartido.
--
-- Con la URL por proyecto, cada cliente puede tener su flujo. El global sigue
-- siendo el respaldo: si esta columna está a NULL, no cambia nada.
--
-- SOLO ADMIN. En el payload de cada acción viajan la ycloud_api_key del
-- proyecto y su tool_config: un campo donde el tenant escriba libremente a
-- dónde se manda eso no debe estar en su panel.

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT;

COMMENT ON COLUMN proyectos.n8n_webhook_url IS
  'Webhook de n8n propio de este proyecto. NULL = usa el global de la plataforma. Solo editable desde admin.';
