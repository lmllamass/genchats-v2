-- migrations/004_super_pro_plan.sql
-- Añadir columna stripe_price_id_super_pro a config_plataforma

ALTER TABLE config_plataforma
  ADD COLUMN IF NOT EXISTS stripe_price_id_super_pro TEXT;

-- Insertar el price ID de Super Pro (99€/mes)
UPDATE config_plataforma
  SET stripe_price_id_super_pro = 'price_1TcKP6G6GJSBuOW4dBPdcGEq'
  WHERE clave = 'plataforma';
