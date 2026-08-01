-- 022_limite_chatbots_por_plan.sql
-- El límite de chatbots por plan pasa a aplicarse en la base de datos.
--
-- Hasta ahora solo existía en el frontend (useSubscription.js): quien llamase a Supabase
-- directamente con su clave anónima podía crear los que quisiera, porque los proyectos se
-- insertan desde el navegador y no pasan por el backend Node. Un CHECK a nivel de tabla no
-- sirve (hay que contar filas de otra fila), así que va como trigger BEFORE INSERT.
--
-- Límites: free 1 · básico/pro 3 · super pro 5.

CREATE OR REPLACE FUNCTION public.limite_chatbots_por_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan  TEXT;
  v_role  TEXT;
  v_max   INT;
  v_tiene INT;
BEGIN
  -- Inserciones desde el backend (service_role) no llevan auth.uid(): son operaciones de
  -- administración y de soporte, y bloquearlas dejaría al equipo sin poder arreglar nada.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan, role INTO v_plan, v_role
    FROM user_profiles WHERE id = NEW.user_id;

  -- El admin de la plataforma gestiona los chatbots de los clientes antes de traspasarlos,
  -- así que no puede estar sujeto al límite de su propio plan.
  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  v_max := CASE COALESCE(v_plan, 'free')
             WHEN 'super-pro' THEN 5
             WHEN 'super_pro' THEN 5
             WHEN 'pro'       THEN 3
             WHEN 'basico'    THEN 3
             ELSE 1
           END;

  SELECT COUNT(*) INTO v_tiene FROM proyectos WHERE user_id = NEW.user_id;

  IF v_tiene >= v_max THEN
    RAISE EXCEPTION 'Has alcanzado el límite de % chatbot(s) de tu plan (%). Mejora tu plan para crear más.',
      v_max, COALESCE(v_plan, 'free')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limite_chatbots ON proyectos;
CREATE TRIGGER trg_limite_chatbots
  BEFORE INSERT ON proyectos
  FOR EACH ROW EXECUTE FUNCTION public.limite_chatbots_por_plan();
