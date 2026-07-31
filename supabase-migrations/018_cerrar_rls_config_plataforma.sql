-- Migration 018: ☠️ CIERRA LA FUGA DE CREDENCIALES. Ejecutar SOLO tras desplegar el frontend
-- que lee la config vía /api/admin/config (si no, el panel de administración se queda en blanco).
--
-- PROBLEMA: `config_plataforma` guarda claves de API en texto plano (Stripe secret key,
-- Stripe webhook secret, YCloud API key…) y su política era:
--     CREATE POLICY "admin_only_config" ON config_plataforma USING (true);
-- Sin `TO service_role`, esa política aplica a PUBLIC — incluido el rol `anon`. Como la clave
-- anónima de Supabase va incrustada en el bundle JS público de la web, cualquiera podía leer
-- esas credenciales SIN LOGIN. Verificado empíricamente contra producción el 2026-07-30.
--
-- ⚠️ IMPORTANTE: esta migración detiene lecturas FUTURAS, pero NO invalida las claves que ya
-- se filtraron. Hay que ROTARLAS (Stripe dashboard, YCloud) — pendiente, acordado con el
-- usuario para más adelante.
--
-- Idempotente: se puede ejecutar varias veces sin error.

DROP POLICY IF EXISTS "admin_only_config" ON config_plataforma;
DROP POLICY IF EXISTS "service_role_config_plataforma" ON config_plataforma;
CREATE POLICY "service_role_config_plataforma" ON config_plataforma
  FOR ALL TO service_role USING (true) WITH CHECK (true);
