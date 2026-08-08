-- ═══════════════════════════════════════════════════════════════════════════
-- PUESTA AL DÍA DE v1  ·  8 de agosto de 2026
--
-- Reúne las tres migraciones que le faltan a v1, en orden. Comprobado contra su
-- esquema real: el resto (identidad omnicanal, project_tools, motor de reservas)
-- ya lo tiene, así que el catálogo de sedes y el aviso de privacidad funcionan
-- sin tocar nada más.
--
-- NO altera el funcionamiento actual de v1: solo añade columnas nuevas (que
-- quedan a NULL), tablas nuevas y un bucket. Nada existente cambia de forma.
-- Se puede pasar hoy y desplegar el código cuando se decida.
--
-- Todo es reejecutable: si algo ya estuviera, no da error.
--
--   023 · retell_api_key por proyecto
--   024 · zona de archivos (tablas, cuota, bucket)
--   025 · aforo por sede
--
-- SI FALLA EL ÚLTIMO BLOQUE (INSERT INTO storage.buckets) por permisos sobre el
-- esquema `storage`, crea el bucket a mano: Storage → New bucket → nombre
-- "archivos", SIN marcar público. El resto ya habrá quedado aplicado.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 023 ──────────────────────────────────────────────────────────────────

-- 023_retell_api_key_por_proyecto.sql
-- API key de Retell por tenant, mismo patrón que ycloud_api_key / resend_api_key.
--
-- Cada cliente tiene su propia cuenta de Retell (el agente de Fadecom vive en la de
-- rmartinez@fadecom.es, no en la de plataforma). Sin su key guardada, cualquier ajuste
-- del agente (denoising, speech_normalization, interruption_sensitivity…) hay que
-- hacerlo a mano en su dashboard: no se puede automatizar ni asistir por API.
--
-- La lee solo el backend con service_role; nunca debe viajar al frontend más allá del
-- formulario de admin donde se pega.

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS retell_api_key TEXT;

COMMENT ON COLUMN proyectos.retell_api_key IS
  'API key de la cuenta Retell del tenant. NULL si el agente vive en la cuenta de plataforma.';


-- ─── 024 ──────────────────────────────────────────────────────────────────

-- 024_archivos_contacto.sql
-- Zona de cargas y descargas: los ficheros cuelgan del CONTACTO, no del canal.
--
-- Como los contactos ya están unificados por la identidad omnicanal (migración
-- 004), un PDF que el cliente final sube por el portal aparece en la misma ficha
-- que sus WhatsApps y sus conversaciones web. Esa es la gracia de colgarlo de
-- `customers` y no de una conversación.
--
-- Dos ejes distintos, y conviene no mezclarlos:
--   · el fichero se guarda por proyecto y contacto  → ruta proyecto_id/customer_id/...
--   · la cuota se cuenta por usuario                → es quien tiene plan en Stripe

-- ── El fichero ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS archivos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  customer_id UUID     REFERENCES customers(id) ON DELETE CASCADE,

  -- Ruta dentro del bucket privado. Única: es la que identifica el objeto en
  -- Storage, y dos filas apuntando al mismo objeto dejarían huérfano a uno de
  -- los dos al borrar.
  ruta        TEXT NOT NULL UNIQUE,
  nombre      TEXT NOT NULL,
  mime        TEXT,
  bytes       BIGINT NOT NULL DEFAULT 0 CHECK (bytes >= 0),

  origen      TEXT NOT NULL DEFAULT 'tenant'
              CHECK (origen IN ('tenant','portal','whatsapp','telegram','email','agente')),
  -- Cuando el fichero responde a algo que el bot pidió expresamente
  -- ("dni_anverso", "justificante"): permite saber si ya está completo.
  slot        TEXT,

  subido_por  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_archivos_contacto ON archivos(proyecto_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archivos_slot     ON archivos(customer_id, slot) WHERE slot IS NOT NULL;

-- ── Los magic link ──────────────────────────────────────────────────────────
--
-- El cliente final no tiene cuenta y no debe tenerla: crear usuarios para los
-- clientes de nuestros clientes mata la adopción. Entra por un enlace firmado
-- que caduca y se puede revocar.
--
-- Se guarda solo el SHA-256 del token, nunca el token. El token existe
-- únicamente dentro de la URL que recibe el contacto, así que quien se lleve
-- una copia de la base de datos no se lleva los enlaces.

CREATE TABLE IF NOT EXISTS archivo_enlaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  proyecto_id   UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  token_hash    TEXT NOT NULL UNIQUE,
  -- cardinality y no array_length: para un array vacío array_length() devuelve
  -- NULL, el CHECK se queda en NULL y PostgreSQL lo da por bueno. Un enlace sin
  -- permisos se colaba y luego no dejaba hacer nada.
  permisos      TEXT[] NOT NULL DEFAULT ARRAY['subir']::TEXT[]
                CHECK (permisos <@ ARRAY['subir','descargar']::TEXT[] AND cardinality(permisos) > 0),

  -- Qué se le pide subir, congelado en el momento de crear el enlace: si el
  -- proyecto cambia después los documentos que exige, el enlace ya enviado
  -- sigue pidiendo lo mismo que le dijimos al contacto.
  slots         JSONB NOT NULL DEFAULT '[]'::JSONB,

  expira_en     TIMESTAMPTZ NOT NULL,
  revocado_en   TIMESTAMPTZ,
  usos          INTEGER NOT NULL DEFAULT 0,
  ultimo_uso_en TIMESTAMPTZ,

  creado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_enlaces_contacto ON archivo_enlaces(proyecto_id, customer_id, created_at DESC);
-- Para la limpieza periódica de enlaces muertos.
CREATE INDEX IF NOT EXISTS idx_enlaces_expira   ON archivo_enlaces(expira_en) WHERE revocado_en IS NULL;

-- supabase-js no sabe escribir `usos = usos + 1`, y leer-y-escribir desde el
-- backend pierde cuentas cuando el contacto abre el enlace desde dos sitios.
CREATE OR REPLACE FUNCTION public.anotar_uso_enlace(p_enlace_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE archivo_enlaces
     SET usos = usos + 1, ultimo_uso_en = NOW()
   WHERE id = p_enlace_id;
$$;

-- ── Cuota de almacenamiento por plan ────────────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS bytes_almacenados BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.cuota_almacenamiento(p_plan TEXT)
RETURNS BIGINT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE COALESCE(p_plan, 'free')
           WHEN 'super-pro' THEN 10737418240::BIGINT   -- 10 GB
           WHEN 'super_pro' THEN 10737418240::BIGINT
           WHEN 'pro'       THEN  2147483648::BIGINT   --  2 GB
           WHEN 'basico'    THEN  2147483648::BIGINT
           ELSE                    104857600::BIGINT   -- 100 MB
         END;
$$;

-- Contador incremental en vez de un SUM() por subida: con unos miles de
-- ficheros por cuenta, sumar en cada alta se vuelve caro enseguida.
CREATE OR REPLACE FUNCTION public.actualizar_uso_almacenamiento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_delta   BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT user_id INTO v_user_id FROM proyectos WHERE id = OLD.proyecto_id;
    v_delta := -OLD.bytes;
  ELSE
    SELECT user_id INTO v_user_id FROM proyectos WHERE id = NEW.proyecto_id;
    v_delta := NEW.bytes - COALESCE(OLD.bytes, 0);
  END IF;

  IF v_user_id IS NOT NULL AND v_delta <> 0 THEN
    UPDATE user_profiles
       SET bytes_almacenados = GREATEST(0, bytes_almacenados + v_delta)
     WHERE id = v_user_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_uso_almacenamiento ON archivos;
CREATE TRIGGER trg_uso_almacenamiento
  AFTER INSERT OR UPDATE OF bytes OR DELETE ON archivos
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_uso_almacenamiento();

CREATE OR REPLACE FUNCTION public.limite_almacenamiento_por_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_plan    TEXT;
  v_role    TEXT;
  v_usado   BIGINT;
  v_max     BIGINT;
BEGIN
  SELECT p.user_id, up.plan, up.role, up.bytes_almacenados
    INTO v_user_id, v_plan, v_role, v_usado
    FROM proyectos p
    LEFT JOIN user_profiles up ON up.id = p.user_id
   WHERE p.id = NEW.proyecto_id;

  -- OJO: aquí NO se puede saltar la comprobación cuando auth.uid() es NULL,
  -- como hace el límite de chatbots (022). Todas las subidas entran por el
  -- backend con service_role y sin auth.uid(), así que hacerlo desactivaría la
  -- cuota por completo. El admin sí queda exento, como en 022.
  IF v_role = 'admin' OR v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_max := public.cuota_almacenamiento(v_plan);

  IF COALESCE(v_usado, 0) + NEW.bytes > v_max THEN
    RAISE EXCEPTION 'Has agotado el almacenamiento de tu plan (% MB). Mejora tu plan o borra archivos.',
      v_max / 1048576
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limite_almacenamiento ON archivos;
CREATE TRIGGER trg_limite_almacenamiento
  BEFORE INSERT ON archivos
  FOR EACH ROW EXECUTE FUNCTION public.limite_almacenamiento_por_plan();

-- ── RLS: como el resto desde la 017, todo pasa por el backend ───────────────

ALTER TABLE archivos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivo_enlaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_archivos" ON archivos;
CREATE POLICY "service_role_archivos" ON archivos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_archivo_enlaces" ON archivo_enlaces;
CREATE POLICY "service_role_archivo_enlaces" ON archivo_enlaces
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tocar_archivos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_archivos_updated_at ON archivos;
CREATE TRIGGER trg_archivos_updated_at
  BEFORE UPDATE ON archivos
  FOR EACH ROW EXECUTE FUNCTION public.tocar_archivos_updated_at();

-- ── El bucket ───────────────────────────────────────────────────────────────
--
-- Privado y SIN políticas para anon/authenticated: nadie llega a un objeto por
-- su cuenta. El backend (service_role) se salta RLS y es quien firma URLs de
-- corta duración cuando toca. Los ficheros que suben terceros nunca se sirven
-- con su propio Content-Type — eso se fuerza al firmar la descarga, porque un
-- HTML o un SVG subido por un contacto sería XSS en nuestro dominio.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('archivos', 'archivos', FALSE, 26214400)   -- 25 MB por objeto
ON CONFLICT (id) DO UPDATE
  SET public = FALSE, file_size_limit = EXCLUDED.file_size_limit;


-- ─── 025 ──────────────────────────────────────────────────────────────────

-- 025_aforo_recurso.sql
-- Aforo por sede.
--
-- Hasta ahora la capacidad vivía en dos sitios y ninguno servía del todo:
--   · `reservas_franjas.capacidad`, que es por franja horaria — sirve para el
--     motor de reservas propio, no para "en esta sede caben 30".
--   · `project_tools.config.plazas_carretillero`, un número global metido en la
--     configuración de un cliente concreto: el mismo aforo para todas sus sedes,
--     y sin forma de cambiarlo desde el panel.
--
-- Va como columna y no dentro de `metadata` porque es un dato del negocio, con
-- su tipo y su restricción, no pegamento de integración como los alias.

ALTER TABLE public.reservas_recursos
  ADD COLUMN IF NOT EXISTS aforo INTEGER CHECK (aforo IS NULL OR aforo > 0);

COMMENT ON COLUMN public.reservas_recursos.aforo IS
  'Plazas totales de la sede. NULL = sin límite conocido; el flujo del cliente decide qué hacer.';
