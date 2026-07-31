-- Migration 019: corrige la heurística de la 016, que degradaba clientes de pago.
--
-- PROBLEMA: la 016 marcaba como 'operadora' a quien estuviera vinculado en
-- proyecto_operadores y NO poseyera proyectos. Pero en esta plataforma los proyectos se
-- crean bajo la cuenta de administración de Konkabeza, así que un cliente que paga puede
-- perfectamente tener 0 proyectos a su nombre. Resultado real: info@agmichalet.com, con
-- plan 'pro', quedó marcada como operadora — y con eso el frontend la encerraría en el
-- inbox, sin acceso a su plan ni a su facturación.
--
-- REGLA: quien tiene un plan de pago es CLIENTE, aunque además atienda proyectos ajenos.
-- Solo es 'operadora' quien no paga nada y únicamente atiende proyectos de otros.

UPDATE user_profiles
SET tipo_cuenta = 'cliente'
WHERE tipo_cuenta = 'operadora'
  AND plan IS NOT NULL
  AND plan NOT IN ('free', 'gratis');

-- Refuerzo a nivel de datos: que no se pueda volver a dar el caso desde la BD.
DROP POLICY IF EXISTS "nunca_operadora_con_plan_de_pago" ON user_profiles;

CREATE OR REPLACE FUNCTION impedir_operadora_con_plan_de_pago()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo_cuenta = 'operadora' AND NEW.plan IS NOT NULL
     AND NEW.plan NOT IN ('free', 'gratis') THEN
    -- No se aborta la operación: se corrige. Un plan de pago siempre gana sobre la etiqueta
    -- de operadora, y así un upgrade de plan no falla por un tipo_cuenta antiguo.
    NEW.tipo_cuenta := 'cliente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_operadora_con_plan ON user_profiles;
CREATE TRIGGER trg_impedir_operadora_con_plan
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION impedir_operadora_con_plan_de_pago();
