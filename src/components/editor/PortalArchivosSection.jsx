import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/backendApi";
import { FolderUp, Plus, Trash2, Loader2, GripVertical, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

/**
 * Qué documentos se le piden al cliente final en el portal.
 *
 * Era lo último que solo se podía cambiar en la base de datos. Cada documento se
 * convierte en una tarjeta de esa pantalla y en un fichero en la ficha del
 * contacto, así que el orden y los textos son decisión del negocio, no nuestra.
 */
export default function PortalArchivosSection({ proyecto }) {
  const proyectoId = proyecto?.id;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["portal-archivos", proyectoId],
    queryFn: () => api.getPortalArchivos(proyectoId),
    enabled: !!proyectoId,
  });

  const [slots, setSlots] = useState([]);
  const [dias, setDias] = useState(7);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSlots(data.slots.map(s => ({ ...s })));
    setDias(data.dias_validez);
  }, [data]);

  const cambiar = (i, campo, valor) =>
    setSlots(ss => ss.map((s, j) => (j === i ? { ...s, [campo]: valor } : s)));

  const mover = (i, delta) => setSlots(ss => {
    const j = i + delta;
    if (j < 0 || j >= ss.length) return ss;
    const copia = [...ss];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    return copia;
  });

  const guardar = async () => {
    if (!slots.length) return toast.error("Pide al menos un documento");
    if (slots.some(s => !s.titulo?.trim())) return toast.error("Cada documento necesita un título");
    setGuardando(true);
    try {
      await api.guardarPortalArchivos(proyectoId, { slots, dias_validez: Number(dias) });
      toast.success("Portal actualizado");
      refetch();
    } catch (err) {
      toast.error(err?.message || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  if (isLoading) {
    return <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Separator />
      <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-1.5">
        <FolderUp className="w-3.5 h-3.5" /> Documentos que pides
      </h3>

      <p className="text-[11px] text-muted-foreground leading-snug">
        Lo que verá el cliente cuando le mandes el enlace para subir sus papeles. Cada uno es una
        tarjeta en su móvil y un archivo en su ficha.
      </p>

      {data?.usando_por_defecto && (
        <p className="text-[10px] text-muted-foreground/70">
          Ahora mismo usa los tres de serie. En cuanto guardes, manda tu lista.
        </p>
      )}

      <div className="space-y-2">
        {slots.map((s, i) => (
          <div key={i} className="rounded-lg border border-border bg-secondary/20 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col shrink-0">
                <button onClick={() => mover(i, -1)} disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-25 leading-none text-[10px]"
                  title="Subir">▲</button>
                <button onClick={() => mover(i, 1)} disabled={i === slots.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-25 leading-none text-[10px]"
                  title="Bajar">▼</button>
              </div>
              <Input
                value={s.titulo || ""}
                onChange={e => cambiar(i, "titulo", e.target.value)}
                placeholder="DNI por la cara delantera"
                className="h-7 text-xs flex-1"
              />
              <button onClick={() => setSlots(ss => ss.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive shrink-0" title="Quitar">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <Input
              value={s.ayuda || ""}
              onChange={e => cambiar(i, "ayuda", e.target.value)}
              placeholder="Pista debajo del título (opcional)"
              className="h-7 text-[11px]"
            />
          </div>
        ))}
      </div>

      <Button size="sm" variant="outline" className="w-full h-7 text-xs"
        onClick={() => setSlots(ss => [...ss, { titulo: "", ayuda: "" }])}>
        <Plus className="w-3 h-3 mr-1" /> Añadir documento
      </Button>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">El enlace caduca a los</span>
        <Input type="number" min="1" max="90" value={dias}
          onChange={e => setDias(e.target.value)} className="h-7 w-16 text-xs" />
        <span className="text-[11px] text-muted-foreground">días</span>
      </div>

      {data?.url_privacidad ? (
        <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
          <ShieldCheck className="w-3 h-3 shrink-0 mt-0.5 text-emerald-500" />
          Antes de subir nada tendrá que aceptar tu política de privacidad. Se cambia arriba, en
          Privacidad.
        </p>
      ) : (
        <p className="text-[10px] text-amber-500/90 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          No has puesto la URL de tu política de privacidad, así que no se le pide que la acepte.
          Se rellena arriba, en Privacidad.
        </p>
      )}

      <Button size="sm" className="w-full h-7 text-xs" onClick={guardar} disabled={guardando}>
        {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar documentos"}
      </Button>
    </div>
  );
}
