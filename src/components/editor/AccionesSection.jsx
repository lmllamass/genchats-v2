import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/backendApi";
import { Zap, Plus, Trash2, Loader2, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

/**
 * Las acciones del agente, editables por el tenant.
 *
 * Cada herramienta es una capacidad que se enciende o se apaga. La de "acciones
 * a medida" es la que más importa: lo que se escribe ahí acaba en el ESQUEMA que
 * ve el modelo, no solo en el prompt, y por eso el nombre se normaliza a
 * identificador — un espacio de más rompe la llamada.
 */
export default function AccionesSection({ proyecto }) {
  const proyectoId = proyecto?.id;
  const [abierta, setAbierta] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tools", proyectoId],
    queryFn: () => api.listarTools(proyectoId),
    enabled: !!proyectoId,
  });

  const herramientas = data?.herramientas || [];
  const activas = herramientas.filter(h => h.enabled).length;

  const alternar = async (h) => {
    try {
      await api.guardarTool(proyectoId, h.nombre, { enabled: !h.enabled });
      refetch();
    } catch (err) {
      toast.error(err?.message || "No se pudo guardar");
    }
  };

  if (isLoading) {
    return (
      <div className="py-4 flex justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Agrupadas como vienen del catálogo, respetando su orden
  const grupos = herramientas.reduce((acc, h) => {
    (acc[h.grupo] = acc[h.grupo] || []).push(h);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Separator />
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" /> Acciones del agente
        </h3>
        <span className="text-[10px] text-muted-foreground">{activas} activa{activas === 1 ? "" : "s"}</span>
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug">
        Lo que el agente puede <strong>hacer</strong>, no solo contar. Sin ninguna activa,
        responde preguntas pero no toca nada de tu negocio.
      </p>

      {data && !data.webhook_configurado && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-500/90 leading-snug">
            El servicio de automatizaciones no está configurado en la plataforma. Puedes dejarlo
            todo preparado, pero las acciones no llegarán a ejecutarse.
          </p>
        </div>
      )}

      {Object.entries(grupos).map(([grupo, items]) => (
        <div key={grupo} className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{grupo}</p>
          {items.map(h => (
            <div key={h.nombre} className="rounded-lg border border-border bg-secondary/20 overflow-hidden">
              <div className="flex items-start gap-2.5 p-2.5">
                <button
                  onClick={() => alternar(h)}
                  role="switch"
                  aria-checked={h.enabled}
                  aria-label={h.titulo}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors mt-0.5 ${h.enabled ? "bg-primary" : "bg-secondary border border-border"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${h.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{h.titulo}</p>
                  <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{h.resumen}</p>
                </div>
                {h.nombre === "custom" && h.enabled && (
                  <button
                    onClick={() => setAbierta(abierta === "custom" ? null : "custom")}
                    className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                    title="Configurar las acciones"
                  >
                    {abierta === "custom"
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {h.nombre === "custom" && h.enabled && abierta === "custom" && (
                <EditorAcciones proyectoId={proyectoId} config={h.config} onGuardado={refetch} />
              )}
            </div>
          ))}
        </div>
      ))}

      {data?.otras?.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Configuración adicional en la base de datos: {data.otras.join(", ")}
        </p>
      )}
    </div>
  );
}

/**
 * Las acciones a medida. Cada una es lo que el modelo puede invocar, así que la
 * descripción no es documentación: es lo que decide si la usa y cuándo.
 */
function EditorAcciones({ proyectoId, config, onGuardado }) {
  const [acciones, setAcciones] = useState(() =>
    (config?.acciones || []).map(a => ({ ...a })));
  const [guardando, setGuardando] = useState(false);

  const cambiar = (i, campo, valor) =>
    setAcciones(as => as.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));

  const guardar = async () => {
    const vacias = acciones.filter(a => !a.nombre?.trim() || !a.descripcion?.trim());
    if (vacias.length) return toast.error("Cada acción necesita nombre y descripción");
    setGuardando(true);
    try {
      // Se conservan las claves que no gestiona esta pantalla (rutas de ficheros,
      // listas del cliente…): esto edita las acciones, no toda la configuración.
      await api.guardarTool(proyectoId, "custom", { config: { ...config, acciones } });
      toast.success("Acciones guardadas");
      onGuardado();
    } catch (err) {
      toast.error(err?.message || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="border-t border-border bg-background/40 p-2.5 space-y-2.5">
      {acciones.length === 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-2">
          Ninguna todavía. Añade la primera y descríbesela al agente.
        </p>
      )}

      {acciones.map((a, i) => (
        <div key={i} className="rounded-lg border border-border p-2.5 space-y-1.5 bg-card/40">
          <div className="flex items-center gap-2">
            <Input
              value={a.nombre || ""}
              onChange={e => cambiar(i, "nombre", e.target.value)}
              placeholder="nombre_de_la_accion"
              className="h-7 text-xs font-mono flex-1"
            />
            <button
              onClick={() => setAcciones(as => as.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-destructive shrink-0"
              title="Quitar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            value={a.descripcion || ""}
            onChange={e => cambiar(i, "descripcion", e.target.value)}
            placeholder="Cuándo debe usarla el agente. Sé concreto: es lo que decide si la llama."
            rows={2}
            className="w-full text-[11px] px-2 py-1.5 rounded-md bg-secondary/50 border border-border resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Input
            value={a.datos || ""}
            onChange={e => cambiar(i, "datos", e.target.value)}
            placeholder='Datos que necesita, ej. { fecha: "AAAA-MM-DD", nombre: "…" }'
            className="h-7 text-[11px] font-mono"
          />
        </div>
      ))}

      <div className="flex gap-2">
        <Button
          size="sm" variant="outline" className="h-7 text-xs flex-1"
          onClick={() => setAcciones(as => [...as, { nombre: "", descripcion: "", datos: "" }])}
        >
          <Plus className="w-3 h-3 mr-1" /> Añadir acción
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar"}
        </Button>
      </div>

      <p className="text-[9px] text-muted-foreground leading-snug">
        El nombre se convierte en identificador (minúsculas y guiones bajos). La descripción es lo
        que ve el agente para decidir cuándo usarla, así que conviene decir <em>cuándo</em>, no solo
        qué hace.
      </p>
    </div>
  );
}
