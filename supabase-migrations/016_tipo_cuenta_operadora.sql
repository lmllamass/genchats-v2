-- Migration 016: tipo de cuenta — distingue cliente (dueño, paga, configura) de operadora
-- (solo atiende conversaciones de proyectos ajenos).
--
-- Hasta ahora toda cuenta era igual: una operadora invitada tenía plan 'free', trial de 7
-- días y podía crear sus propios chatbots. Con esto, la operadora es una cuenta "ligera":
-- sin plan, sin trial, sin facturación, y el frontend la lleva directa a su inbox.
--
-- Idempotente: se puede ejecutar varias veces sin error.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT NOT NULL DEFAULT 'cliente';

-- Se añade el CHECK por separado y de forma tolerante: si la columna ya existía con datos,
-- un CHECK en el ADD COLUMN podría fallar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_tipo_cuenta_check'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_tipo_cuenta_check
      CHECK (tipo_cuenta IN ('cliente', 'operadora'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_tipo_cuenta ON user_profiles(tipo_cuenta);

-- Marca como operadora a quien ya esté vinculado como tal y NO posea ningún proyecto.
-- (Quien tenga proyectos propios sigue siendo cliente aunque además atienda otros.)
UPDATE user_profiles up
SET tipo_cuenta = 'operadora'
WHERE up.tipo_cuenta = 'cliente'
  AND EXISTS (
    SELECT 1 FROM proyecto_operadores po WHERE po.user_id = up.id AND po.activo = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM proyectos p WHERE p.user_id = up.id
  );
