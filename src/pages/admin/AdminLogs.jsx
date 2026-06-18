import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lead, Proyecto } from "@/api/entidades";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Phone, MessageSquare } from "lucide-react";
import { format } from "date-fns";

const CANAL_ICONS = {
  web: Globe,
  whatsapp: Phone,
  telegram: MessageSquare,
  embed: Globe,
};

const CANAL_COLORS = {
  web: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  whatsapp: "bg-green-500/20 text-green-300 border-green-500/30",
  telegram: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  embed: "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

export default function AdminLogs() {
  const [filterProyecto, setFilterProyecto] = useState("all");

  const { data: leads = [] } = useQuery({
    queryKey: ["admin-leads"],
    queryFn: () => Lead.listAll(50),
    initialData: [],
  });

  const { data: proyectos = [] } = useQuery({
    queryKey: ["admin-proyectos"],
    queryFn: () => Proyecto.listAll(),
    initialData: [],
  });

  const proyectoMap = {};
  proyectos.forEach(p => { proyectoMap[p.id] = p.nombre; });

  const filtered = leads.filter(l => {
    return filterProyecto === "all" || l.proyecto_id === filterProyecto;
  }).slice(0, 20);

  return (
    <div className="px-6 md:px-10 py-8 md:py-12 max-w-[1400px] mx-auto">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Administración</div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Log de <span className="gradient-text">Actividad</span>
        </h1>
        <p className="text-muted-foreground mt-2">Últimas conversaciones procesadas</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <Select value={filterProyecto} onValueChange={setFilterProyecto}>
          <SelectTrigger className="w-64 bg-card/60"><SelectValue placeholder="Filtrar proyecto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {proyectos.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Logs table */}
      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Proyecto</th>
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Visitante</th>
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Nombre</th>
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Canal</th>
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Mensajes</th>
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Estado</th>
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const CanalIcon = CANAL_ICONS[l.canal] || Globe;
                return (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3 text-xs font-medium">{proyectoMap[l.proyecto_id] || l.proyecto_id}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground truncate max-w-[150px]">{l.visitor_id || "—"}</td>
                    <td className="px-5 py-3 text-xs">{l.nombre || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border ${CANAL_COLORS[l.canal] || "bg-secondary text-muted-foreground border-border"}`}>
                        <CanalIcon className="w-3 h-3" /> {l.canal || "web"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs font-mono">{l.mensajes_count || 0}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${
                        l.estado === "cualificado" ? "bg-green-500/20 text-green-300 border-green-500/30" :
                        l.estado === "contactado" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                        l.estado === "descartado" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                        "bg-secondary text-muted-foreground border-border"
                      }`}>
                        {l.estado || "nuevo"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {l.created_at ? format(new Date(l.created_at), "d MMM yyyy HH:mm") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground">Sin actividad reciente.</div>}
      </div>
    </div>
  );
}
