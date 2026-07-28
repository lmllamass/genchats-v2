-- migrations/010_reservas_engine.sql
-- Motor de reservas con aforo — genérico para cualquier vertical:
--   · Curso:       recurso = sede,  franja = día lectivo 10:00, capacidad 30, unidades 1 (alumno)
--   · Restaurante: recurso = local, franja = 13:00/13:30/21:00,  capacidad 40, unidades N (comensales)
--   · Cita:        recurso = profesional, franja = hueco, capacidad 1, unidades 1
--
-- `concertar_cita` es un caso particular de este motor (aforo 1). La tabla `citas`
-- se mantiene por compatibilidad; la migración de sus filas puede hacerse después.
--
-- Toda la aritmética de aforo vive en las RPC, NO en el backend: son atómicas
-- (pg_advisory_xact_lock por franja) y por tanto seguras ante reservas simultáneas.
-- Idempotente.

-- ─────────────────────────────────────────────────────────────
-- TABLAS
-- ─────────────────────────────────────────────────────────────

-- Recurso reservable: sede, local, sala, profesional…
CREATE TABLE IF NOT EXISTS public.reservas_recursos (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id  uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  direccion    text,
  maps_url     text,
  calendar_id  text,                      -- Google Calendar de este recurso (opcional)
  activo       boolean NOT NULL DEFAULT true,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (proyecto_id, nombre)
);

-- Plantilla semanal de disponibilidad. Sin fila aquí, no hay nada reservable.
CREATE TABLE IF NOT EXISTS public.reservas_franjas (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recurso_id   uuid NOT NULL REFERENCES public.reservas_recursos(id) ON DELETE CASCADE,
  dia_semana   smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),  -- ISO: 1=lunes … 7=domingo
  hora         time NOT NULL,
  capacidad    integer NOT NULL CHECK (capacidad > 0),
  duracion_min integer NOT NULL DEFAULT 60 CHECK (duracion_min > 0),
  etiqueta     text,                      -- "Turno mañana", "Comida", "Cena"…
  activa       boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (recurso_id, dia_semana, hora)
);

-- Excepciones: festivos, vacaciones, cierre puntual.
-- recurso_id NULL = aplica a todos los recursos del proyecto.
CREATE TABLE IF NOT EXISTS public.reservas_cierres (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id  uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  recurso_id   uuid REFERENCES public.reservas_recursos(id) ON DELETE CASCADE,
  fecha        date NOT NULL,
  motivo       text,
  created_at   timestamptz DEFAULT now()
);

-- Reservas. `unidades` = plazas consumidas (1 alumno / N comensales).
CREATE TABLE IF NOT EXISTS public.reservas (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id       uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  recurso_id        uuid NOT NULL REFERENCES public.reservas_recursos(id) ON DELETE CASCADE,
  codigo            text NOT NULL,
  fecha             date NOT NULL,
  hora              time NOT NULL,
  unidades          integer NOT NULL DEFAULT 1 CHECK (unidades > 0),
  nombre_cliente    text,
  telefono_cliente  text,
  email_cliente     text,
  documento         text,
  notas             text,
  estado            text NOT NULL DEFAULT 'confirmada'
                    CHECK (estado IN ('confirmada','cancelada','lista_espera','completada','no_show')),
  canal             text DEFAULT 'phone',
  visitor_id        text,
  customer_id       uuid,                 -- enlaza con la identidad omnicanal de v2
  calendar_event_id text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);

CREATE INDEX IF NOT EXISTS reservas_recursos_proyecto_idx ON public.reservas_recursos(proyecto_id);
CREATE INDEX IF NOT EXISTS reservas_franjas_recurso_idx   ON public.reservas_franjas(recurso_id, dia_semana);
CREATE INDEX IF NOT EXISTS reservas_cierres_lookup_idx    ON public.reservas_cierres(proyecto_id, fecha);
CREATE INDEX IF NOT EXISTS reservas_proyecto_idx          ON public.reservas(proyecto_id);
-- Índice clave para el recuento de aforo (la consulta más caliente del motor)
CREATE INDEX IF NOT EXISTS reservas_aforo_idx             ON public.reservas(recurso_id, fecha, hora)
  WHERE estado = 'confirmada';
-- Para "¿qué reserva tiene este teléfono?" (modificar / cancelar por voz)
CREATE INDEX IF NOT EXISTS reservas_telefono_idx          ON public.reservas(proyecto_id, telefono_cliente);

ALTER TABLE public.reservas_recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_franjas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_cierres  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_reservas_recursos" ON public.reservas_recursos;
CREATE POLICY "service_role_reservas_recursos" ON public.reservas_recursos
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_reservas_franjas" ON public.reservas_franjas;
CREATE POLICY "service_role_reservas_franjas" ON public.reservas_franjas
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_reservas_cierres" ON public.reservas_cierres;
CREATE POLICY "service_role_reservas_cierres" ON public.reservas_cierres
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_reservas" ON public.reservas;
CREATE POLICY "service_role_reservas" ON public.reservas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.reservas_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER trg_reservas_updated_at
  BEFORE UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.reservas_touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- HELPERS
-- ─────────────────────────────────────────────────────────────

-- Código corto legible por teléfono: sin 0/O/1/I/B/8 para evitar confusiones al dictarlo.
CREATE OR REPLACE FUNCTION public.reservas_gen_codigo()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT string_agg(
    substr('ACDEFGHJKLMNPQRSTUVWXYZ2345679', (floor(random() * 30) + 1)::int, 1), ''
  ) FROM generate_series(1, 6);
$$;

-- Serializa las operaciones sobre una misma franja (recurso+fecha+hora).
-- Evita la condición de carrera del "leer aforo → escribir" sin bloquear la tabla:
-- un SELECT ... FOR UPDATE no sirve aquí porque el problema son las filas que
-- todavía no existen (phantom read).
CREATE OR REPLACE FUNCTION public.reservas_lock_franja(p_recurso uuid, p_fecha date, p_hora time)
RETURNS void LANGUAGE sql AS $$
  SELECT pg_advisory_xact_lock(
    hashtextextended(p_recurso::text || '|' || p_fecha::text || '|' || p_hora::text, 0)
  );
$$;

-- Capacidad configurada de una franja concreta (0 si no existe, está inactiva o es día cerrado).
CREATE OR REPLACE FUNCTION public.reservas_capacidad(p_recurso uuid, p_fecha date, p_hora time)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT COALESCE((
    SELECT f.capacidad
    FROM public.reservas_franjas f
    JOIN public.reservas_recursos r ON r.id = f.recurso_id
    WHERE f.recurso_id = p_recurso
      AND f.hora = p_hora
      AND f.dia_semana = EXTRACT(ISODOW FROM p_fecha)
      AND f.activa AND r.activo
      AND NOT EXISTS (
        SELECT 1 FROM public.reservas_cierres c
        WHERE c.fecha = p_fecha
          AND (c.recurso_id = r.id OR (c.recurso_id IS NULL AND c.proyecto_id = r.proyecto_id))
      )
  ), 0);
$$;

CREATE OR REPLACE FUNCTION public.reservas_ocupadas(p_recurso uuid, p_fecha date, p_hora time)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(unidades), 0)::int
  FROM public.reservas
  WHERE recurso_id = p_recurso AND fecha = p_fecha AND hora = p_hora
    AND estado = 'confirmada';
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC 1 · Disponibilidad
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reservas_disponibilidad(
  p_proyecto uuid,
  p_recurso  uuid    DEFAULT NULL,
  p_desde    date    DEFAULT NULL,
  p_dias     integer DEFAULT 21,
  p_unidades integer DEFAULT 1
)
RETURNS TABLE (
  recurso_id uuid, recurso text, direccion text, maps_url text,
  fecha date, hora time, etiqueta text,
  capacidad integer, ocupadas integer, libres integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH dias AS (
    SELECT d::date AS fecha
    FROM generate_series(
      COALESCE(p_desde, CURRENT_DATE),
      COALESCE(p_desde, CURRENT_DATE) + (GREATEST(COALESCE(p_dias, 21), 1) - 1),
      interval '1 day'
    ) d
  )
  SELECT r.id, r.nombre, r.direccion, r.maps_url,
         d.fecha, f.hora, f.etiqueta,
         f.capacidad,
         public.reservas_ocupadas(r.id, d.fecha, f.hora),
         f.capacidad - public.reservas_ocupadas(r.id, d.fecha, f.hora)
  FROM dias d
  JOIN public.reservas_recursos r
    ON r.proyecto_id = p_proyecto AND r.activo
   AND (p_recurso IS NULL OR r.id = p_recurso)
  JOIN public.reservas_franjas f
    ON f.recurso_id = r.id AND f.activa
   AND f.dia_semana = EXTRACT(ISODOW FROM d.fecha)
  WHERE NOT EXISTS (
      SELECT 1 FROM public.reservas_cierres c
      WHERE c.fecha = d.fecha
        AND (c.recurso_id = r.id OR (c.recurso_id IS NULL AND c.proyecto_id = p_proyecto))
    )
    AND (d.fecha > CURRENT_DATE OR (d.fecha = CURRENT_DATE AND f.hora > CURRENT_TIME))
    AND f.capacidad - public.reservas_ocupadas(r.id, d.fecha, f.hora)
        >= GREATEST(COALESCE(p_unidades, 1), 1)
  ORDER BY d.fecha, f.hora, r.nombre;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC 2 · Crear reserva (atómica)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reservas_crear(
  p_proyecto   uuid,
  p_recurso    uuid,
  p_fecha      date,
  p_hora       time,
  p_nombre     text,
  p_telefono   text,
  p_unidades   integer DEFAULT 1,
  p_email      text DEFAULT NULL,
  p_documento  text DEFAULT NULL,
  p_notas      text DEFAULT NULL,
  p_canal      text DEFAULT 'phone',
  p_visitor_id text DEFAULT NULL,
  p_customer   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_units  integer := GREATEST(COALESCE(p_unidades, 1), 1);
  v_cap    integer;
  v_ocup   integer;
  v_codigo text;
  v_row    public.reservas%ROWTYPE;
BEGIN
  IF p_recurso IS NULL OR p_fecha IS NULL OR p_hora IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'datos_incompletos');
  END IF;

  PERFORM public.reservas_lock_franja(p_recurso, p_fecha, p_hora);

  -- Idempotencia: si ya tiene reserva para esa misma franja, la devolvemos tal cual.
  SELECT * INTO v_row FROM public.reservas
  WHERE proyecto_id = p_proyecto AND recurso_id = p_recurso
    AND fecha = p_fecha AND hora = p_hora
    AND telefono_cliente IS NOT DISTINCT FROM p_telefono
    AND estado = 'confirmada'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'duplicado', true,
      'codigo', v_row.codigo, 'fecha', v_row.fecha, 'hora', v_row.hora,
      'unidades', v_row.unidades, 'reserva_id', v_row.id);
  END IF;

  v_cap  := public.reservas_capacidad(p_recurso, p_fecha, p_hora);
  IF v_cap = 0 THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'franja_inexistente');
  END IF;

  v_ocup := public.reservas_ocupadas(p_recurso, p_fecha, p_hora);
  IF v_ocup + v_units > v_cap THEN
    RETURN jsonb_build_object(
      'ok', false, 'motivo', 'completo',
      'capacidad', v_cap, 'ocupadas', v_ocup, 'libres', v_cap - v_ocup);
  END IF;

  LOOP
    v_codigo := public.reservas_gen_codigo();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.reservas WHERE proyecto_id = p_proyecto AND codigo = v_codigo);
  END LOOP;

  INSERT INTO public.reservas (
    proyecto_id, recurso_id, codigo, fecha, hora, unidades,
    nombre_cliente, telefono_cliente, email_cliente, documento, notas,
    estado, canal, visitor_id, customer_id)
  VALUES (
    p_proyecto, p_recurso, v_codigo, p_fecha, p_hora, v_units,
    p_nombre, p_telefono, p_email, p_documento, p_notas,
    'confirmada', COALESCE(p_canal, 'phone'), p_visitor_id, p_customer)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true, 'duplicado', false,
    'codigo', v_row.codigo, 'reserva_id', v_row.id,
    'fecha', v_row.fecha, 'hora', v_row.hora, 'unidades', v_row.unidades,
    'libres_restantes', v_cap - v_ocup - v_units,
    'calendar_id', (SELECT calendar_id FROM public.reservas_recursos WHERE id = p_recurso));
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC 3 · Modificar reserva (atómica sobre AMBAS franjas)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reservas_modificar(
  p_proyecto     uuid,
  p_codigo       text,
  p_nuevo_recurso uuid    DEFAULT NULL,
  p_nueva_fecha   date    DEFAULT NULL,
  p_nueva_hora    time    DEFAULT NULL,
  p_nuevas_unidades integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row   public.reservas%ROWTYPE;
  v_rec   uuid; v_fec date; v_hor time; v_uni integer;
  v_cap   integer; v_ocup integer; v_propias integer;
  v_k_old bigint; v_k_new bigint;
BEGIN
  SELECT * INTO v_row FROM public.reservas
  WHERE proyecto_id = p_proyecto AND codigo = upper(trim(p_codigo));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'no_encontrada');
  END IF;
  IF v_row.estado <> 'confirmada' THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'no_modificable', 'estado', v_row.estado);
  END IF;

  v_rec := COALESCE(p_nuevo_recurso, v_row.recurso_id);
  v_fec := COALESCE(p_nueva_fecha,   v_row.fecha);
  v_hor := COALESCE(p_nueva_hora,    v_row.hora);
  v_uni := GREATEST(COALESCE(p_nuevas_unidades, v_row.unidades), 1);

  IF (v_rec, v_fec, v_hor, v_uni) IS NOT DISTINCT FROM
     (v_row.recurso_id, v_row.fecha, v_row.hora, v_row.unidades) THEN
    RETURN jsonb_build_object('ok', true, 'sin_cambios', true, 'codigo', v_row.codigo);
  END IF;

  -- Bloqueo en orden determinista de las dos franjas → sin deadlocks entre
  -- modificaciones cruzadas (A→B mientras otra hace B→A).
  v_k_old := hashtextextended(v_row.recurso_id::text || '|' || v_row.fecha::text || '|' || v_row.hora::text, 0);
  v_k_new := hashtextextended(v_rec::text || '|' || v_fec::text || '|' || v_hor::text, 0);
  IF v_k_old <= v_k_new THEN
    PERFORM pg_advisory_xact_lock(v_k_old);
    IF v_k_new <> v_k_old THEN PERFORM pg_advisory_xact_lock(v_k_new); END IF;
  ELSE
    PERFORM pg_advisory_xact_lock(v_k_new);
    PERFORM pg_advisory_xact_lock(v_k_old);
  END IF;

  v_cap := public.reservas_capacidad(v_rec, v_fec, v_hor);
  IF v_cap = 0 THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'franja_inexistente');
  END IF;

  v_ocup := public.reservas_ocupadas(v_rec, v_fec, v_hor);
  -- Si sigue en la misma franja, sus propias unidades no cuentan como ocupación ajena.
  v_propias := CASE
    WHEN v_rec = v_row.recurso_id AND v_fec = v_row.fecha AND v_hor = v_row.hora
    THEN v_row.unidades ELSE 0 END;

  IF v_ocup - v_propias + v_uni > v_cap THEN
    RETURN jsonb_build_object(
      'ok', false, 'motivo', 'completo',
      'capacidad', v_cap, 'libres', v_cap - (v_ocup - v_propias));
  END IF;

  UPDATE public.reservas
     SET recurso_id = v_rec, fecha = v_fec, hora = v_hor, unidades = v_uni
   WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true, 'codigo', v_row.codigo, 'reserva_id', v_row.id,
    'fecha', v_row.fecha, 'hora', v_row.hora, 'unidades', v_row.unidades,
    'recurso_id', v_row.recurso_id,
    'calendar_event_id', v_row.calendar_event_id,
    'calendar_id', (SELECT calendar_id FROM public.reservas_recursos WHERE id = v_rec));
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC 4 · Cancelar (libera aforo y señala lista de espera)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reservas_cancelar(
  p_proyecto uuid,
  p_codigo   text,
  p_motivo   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.reservas%ROWTYPE;
  v_esp public.reservas%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.reservas
  WHERE proyecto_id = p_proyecto AND codigo = upper(trim(p_codigo));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'no_encontrada');
  END IF;
  IF v_row.estado = 'cancelada' THEN
    RETURN jsonb_build_object('ok', true, 'ya_cancelada', true, 'codigo', v_row.codigo);
  END IF;

  PERFORM public.reservas_lock_franja(v_row.recurso_id, v_row.fecha, v_row.hora);

  UPDATE public.reservas
     SET estado = 'cancelada',
         notas  = COALESCE(notas || ' | ', '') || COALESCE('Cancelada: ' || p_motivo, 'Cancelada')
   WHERE id = v_row.id
  RETURNING * INTO v_row;

  -- Primer candidato en lista de espera de esa franja (no se promociona aquí:
  -- lo decide el backend tras avisar al cliente y recibir su confirmación).
  SELECT * INTO v_esp FROM public.reservas
  WHERE recurso_id = v_row.recurso_id AND fecha = v_row.fecha AND hora = v_row.hora
    AND estado = 'lista_espera'
  ORDER BY created_at
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true, 'codigo', v_row.codigo,
    'calendar_event_id', v_row.calendar_event_id,
    'libres', public.reservas_capacidad(v_row.recurso_id, v_row.fecha, v_row.hora)
              - public.reservas_ocupadas(v_row.recurso_id, v_row.fecha, v_row.hora),
    'espera', CASE WHEN v_esp.id IS NULL THEN NULL ELSE jsonb_build_object(
        'codigo', v_esp.codigo, 'nombre', v_esp.nombre_cliente,
        'telefono', v_esp.telefono_cliente, 'unidades', v_esp.unidades) END);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC 5 · Buscar reservas del cliente (para modificar/cancelar por voz sin código)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reservas_buscar(
  p_proyecto  uuid,
  p_telefono  text DEFAULT NULL,
  p_codigo    text DEFAULT NULL,
  p_customer  uuid DEFAULT NULL
)
RETURNS TABLE (
  codigo text, recurso text, direccion text, fecha date, hora time,
  unidades integer, estado text, nombre_cliente text, calendar_event_id text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.codigo, rec.nombre, rec.direccion, r.fecha, r.hora,
         r.unidades, r.estado, r.nombre_cliente, r.calendar_event_id
  FROM public.reservas r
  JOIN public.reservas_recursos rec ON rec.id = r.recurso_id
  WHERE r.proyecto_id = p_proyecto
    AND r.estado IN ('confirmada', 'lista_espera')
    AND r.fecha >= CURRENT_DATE
    AND (
      (p_codigo   IS NOT NULL AND r.codigo = upper(trim(p_codigo)))
      OR (p_telefono IS NOT NULL AND r.telefono_cliente = p_telefono)
      OR (p_customer IS NOT NULL AND r.customer_id = p_customer)
    )
  ORDER BY r.fecha, r.hora;
$$;
