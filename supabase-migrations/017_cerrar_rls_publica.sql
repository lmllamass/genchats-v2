-- Migration 017: ☠️ CIERRA UNA FUGA DE DATOS. Ejecutar SOLO tras desplegar el frontend que
-- deja de leer estas tablas directamente (si no, el panel de conversaciones y leads se rompe).
--
-- PROBLEMA: estas políticas se escribieron con `USING (true)` y SIN la cláusula
-- `TO service_role`, aunque el nombre lo sugiriese. En PostgreSQL, una política sin `TO` se
-- aplica a PUBLIC — es decir, también a los roles `anon` y `authenticated`. Como la clave
-- anónima de Supabase va incrustada en el bundle JS público, cualquiera podía leer, SIN
-- LOGIN, los datos de TODOS los tenants:
--
--   · leads              → nombres, emails, teléfonos, notas (datos personales, RGPD)
--   · mensajes_wa        → mensajes de WhatsApp
--   · conversaciones_chat → historial completo de conversaciones
--
-- Verificado empíricamente contra producción (17 leads legibles sin autenticar).
--
-- FIX: recrear las políticas restringidas a service_role. El backend usa service_role (que
-- además ignora RLS), así que la app sigue funcionando siempre que el frontend pase por él.
--
-- Idempotente: se puede ejecutar varias veces sin error.

-- ── leads ──
DROP POLICY IF EXISTS "service_role_leads" ON leads;
CREATE POLICY "service_role_leads" ON leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── mensajes_wa ──
DROP POLICY IF EXISTS "service_role_mensajes_wa" ON mensajes_wa;
CREATE POLICY "service_role_mensajes_wa" ON mensajes_wa
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── conversaciones_chat ──
DROP POLICY IF EXISTS "service_role_conversaciones" ON conversaciones_chat;
CREATE POLICY "service_role_conversaciones" ON conversaciones_chat
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── config_global: mismo patrón, aunque no contiene datos personales ──
DROP POLICY IF EXISTS "service_role_config_global" ON config_global;
CREATE POLICY "service_role_config_global" ON config_global
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- NOTA: `config_plataforma` tiene la política "admin_only_config" con el mismo defecto
-- (USING (true) sin TO). Contiene CLAVES DE API (Stripe, YCloud, Anthropic…). No se toca
-- aquí porque el panel de administración la lee desde el navegador con la clave anónima y
-- cerrarla lo dejaría inservible — hay que migrar ese panel al backend primero.
-- Comprobado: hoy devuelve vacío al rol anónimo (la fila existe pero no se filtra), así que
-- no hay fuga confirmada, pero conviene revisarlo aparte. Ver aviso al usuario.
