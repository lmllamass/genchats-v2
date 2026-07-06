-- Pedidos y citas — consumidas por las acciones nativas del agente (capturar_pedido / concertar_cita).
-- Idénticas a la tabla de v1 (migración 008 de v1). Idempotente.

CREATE TABLE IF NOT EXISTS public.pedidos (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id      uuid REFERENCES public.proyectos(id) ON DELETE CASCADE,
  visitor_id       text,
  canal            text DEFAULT 'phone',
  datos            jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado           text DEFAULT 'nuevo' CHECK (estado IN ('nuevo','confirmado','en_proceso','completado','cancelado')),
  telefono_cliente text,
  email_cliente    text,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.citas (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id      uuid REFERENCES public.proyectos(id) ON DELETE CASCADE,
  visitor_id       text,
  canal            text DEFAULT 'phone',
  nombre_cliente   text,
  telefono_cliente text,
  email_cliente    text,
  fecha_solicitada text,
  motivo           text,
  notas            text,
  estado           text DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmada','cancelada','completada')),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pedidos_proyecto_id_idx ON public.pedidos(proyecto_id);
CREATE INDEX IF NOT EXISTS citas_proyecto_id_idx   ON public.citas(proyecto_id);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas   ENABLE ROW LEVEL SECURITY;
