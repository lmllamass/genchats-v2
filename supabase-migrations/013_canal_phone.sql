-- 013_canal_phone.sql
-- La voz pasa a ser un canal de primera clase en el inbox.
--
-- Hasta ahora el CHECK de conversaciones_chat.canal solo admitía
-- ('web','whatsapp','telegram','embed'), así que retellWebhook.js insertaba sin `canal`
-- y todas las llamadas caían en el default 'web'. Resultado: las llamadas aparecían en el
-- inbox mezcladas con el chat web y sin forma de distinguirlas.

-- 1. Ampliar el dominio de `canal` con 'phone'
ALTER TABLE conversaciones_chat DROP CONSTRAINT IF EXISTS conversaciones_chat_canal_check;
ALTER TABLE conversaciones_chat ADD CONSTRAINT conversaciones_chat_canal_check
  CHECK (canal IN ('web','whatsapp','telegram','embed','phone'));

-- 2. Backfill: reetiquetar como 'phone' las conversaciones que ya son llamadas.
--    El visitor_id de una llamada es el call_id de Retell ('call_…') o el fallback
--    'retell_<proyecto>_<ts>' que usa el webhook cuando Retell no manda call_id.
UPDATE conversaciones_chat
   SET canal = 'phone'
 WHERE canal = 'web'
   AND (visitor_id LIKE 'call\_%' OR visitor_id LIKE 'retell\_%');

-- 3. Mismo backfill en la tabla de metadatos (solo tiene filas si hubo takeover humano).
UPDATE conversaciones
   SET canal = 'phone'
 WHERE canal = 'web'
   AND (visitor_id LIKE 'call\_%' OR visitor_id LIKE 'retell\_%');

-- Índice para el filtro por canal del inbox
CREATE INDEX IF NOT EXISTS idx_conversaciones_chat_canal
  ON conversaciones_chat (proyecto_id, canal, created_at DESC);
