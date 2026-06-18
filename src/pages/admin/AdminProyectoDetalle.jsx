import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Proyecto } from "@/api/entidades";
import { api } from "@/api/backendApi";
import { ArrowLeft, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import WhatsAppProjectSection from "@/components/admin/WhatsAppProjectSection";
import WhatsAppMessageHistory from "@/components/admin/WhatsAppMessageHistory";
import TelegramProjectSection from "@/components/admin/TelegramProjectSection";
import ToolsProjectSection from "@/components/admin/ToolsProjectSection";
import RetellProjectSection from "@/components/admin/RetellProjectSection";
import { useConfigPlataforma } from "@/components/admin/config/useConfigPlataforma";

const ESTADO_OPTIONS = ["activo", "pro_activo", "pausado", "inactivo"];
const ESTADO_COLORS = {
  pro_activo: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  activo: "bg-green-500/20 text-green-300 border-green-500/30",
  pausado: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  inactivo: "bg-red-500/20 text-red-300 border-red-500/30",
};

export default function AdminProyectoDetalle() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { config: configPlataforma } = useConfigPlataforma();

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ["admin-proyecto", id],
    queryFn: () => Proyecto.get(id),
  });

  // Uses backend service role — bypasses RLS, works for any user's project
  const updateMut = useMutation({
    mutationFn: (data) => api.adminUpdateProyecto(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-proyecto", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-proyectos"] });
      toast.success("✅ Proyecto actualizado");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const cycleEstado = () => {
    const current = proyecto?.estado || "activo";
    const idx = ESTADO_OPTIONS.indexOf(current);
    const next = ESTADO_OPTIONS[(idx + 1) % ESTADO_OPTIONS.length];
    updateMut.mutate({ estado: next });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
      </div>
    );
  }

  if (!proyecto) {
    return (
      <div className="px-6 md:px-10 py-12 text-center">
        <p className="text-white/60">Proyecto no encontrado</p>
        <Link to="/admin/proyectos"><Button variant="outline" className="mt-4">Volver</Button></Link>
      </div>
    );
  }

  const estadoColor = ESTADO_COLORS[proyecto.estado] || "bg-white/10 text-white/50 border-white/10";

  return (
    <div className="px-6 md:px-10 py-8 md:py-12 max-w-[1000px] mx-auto" style={{ background: "#0a0f1e", minHeight: "100vh" }}>
      <Link to="/admin/proyectos" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a proyectos
      </Link>

      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-orange-400/60 mb-2">Proyecto</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-white">{proyecto.nombre}</h1>
        <p className="text-white/40 mt-1 text-sm">{proyecto.url_origen}</p>
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          {/* Estado badge — click to cycle */}
          <button
            onClick={cycleEstado}
            disabled={updateMut.isPending}
            title="Click para cambiar estado"
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 ${estadoColor}`}
          >
            {updateMut.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5" />}
            {proyecto.estado}
          </button>
          {proyecto.estado !== "pro_activo" && (
            <button
              onClick={() => updateMut.mutate({ estado: "pro_activo" })}
              disabled={updateMut.isPending}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
            >
              → Pro Activo
            </button>
          )}
          {proyecto.estado !== "activo" && proyecto.estado !== "pro_activo" && (
            <button
              onClick={() => updateMut.mutate({ estado: "activo" })}
              disabled={updateMut.isPending}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer"
            >
              → Activo
            </button>
          )}
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/50 border border-white/10">
            ID: {proyecto.id}
          </span>
        </div>
      </div>

      <WhatsAppProjectSection
        proyecto={proyecto}
        onUpdate={(data) => updateMut.mutate(data)}
        saving={updateMut.isPending}
        configPlataforma={configPlataforma}
      />

      <TelegramProjectSection
        proyecto={proyecto}
        onUpdate={(data) => updateMut.mutate(data)}
        saving={updateMut.isPending}
      />

      <RetellProjectSection
        proyecto={proyecto}
        onUpdate={(data) => updateMut.mutate(data)}
        saving={updateMut.isPending}
      />

      <WhatsAppMessageHistory proyectoId={proyecto.id} />

      <ToolsProjectSection proyecto={proyecto} />
    </div>
  );
}
