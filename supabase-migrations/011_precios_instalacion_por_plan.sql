-- migrations/011_precios_instalacion_por_plan.sql
-- La instalación pasa a tener importe distinto según el plan (Pro 490€ · Super Pro 1500€),
-- así que hace falta un price_id por plan. `stripe_price_id_instalacion` (genérico, 69€)
-- se mantiene como fallback para no romper nada que aún lo use.
--
-- Los precios ya están creados en Stripe (LIVE) con tax_behavior='exclusive', de modo que
-- Stripe Tax les suma el 21% en el checkout. Idempotente.

ALTER TABLE config_plataforma
  ADD COLUMN IF NOT EXISTS stripe_price_id_instalacion_pro       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id_instalacion_super_pro TEXT;

UPDATE config_plataforma
   SET stripe_price_id_instalacion_pro       = 'price_1Ty4vmG6GJSBuOW4VwENuktz',  -- 490 €
       stripe_price_id_instalacion_super_pro = 'price_1Ty4vnG6GJSBuOW43RugWmWV',  -- 1500 €
       stripe_price_id_pro                   = 'price_1Ty4vlG6GJSBuOW4OSVryhpw',  -- 79 €/mes
       stripe_price_id_super_pro             = 'price_1Ty4vmG6GJSBuOW4hTEcouoB'   -- 149 €/mes
 WHERE clave = 'plataforma';
