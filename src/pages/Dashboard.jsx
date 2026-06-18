import { Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Proyecto } from "@/api/entidades";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import EmptyState from "@/components/EmptyState";
import ProyectoCard from "@/components/ProyectoCard";
import { toast } from "sonner";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: proyectos = [], isLoading } = useQuery({
    queryKey: ["proyectos", user?.id],
    queryFn: () => Proyecto.list(user.id),
    enabled: !!user?.id,
    initialData: [],
  });

  const deleteMut = useMutation({
    mutationFn: (id) => Proyecto.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["proyectos"] }); toast.success("Proyecto eliminado"); },
  });

  const duplicateMut = useMutation({
    mutationFn: async (p) => {
      const { id, created_at, updated_at, user_id, ...rest } = p;
      return Proyecto.create({ ...rest, nombre: `${rest.nombre} (copia)` }, user.id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["proyectos"] }); toast.success("Proyecto duplicado"); },
  });

  const handleDelete = (p) => { if (window.confirm(`¿Eliminar "${p.nombre}"?`)) deleteMut.mutate(p.id); };

  const filtered = proyectos.filter(p => !search || p.nombre?.toLowerCase().includes(search.toLowerCase()) || p.url_origen?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="px-6 md:px-10 py-8 md:py-12 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Workspace</div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Mis <span className="gradient-text">chatbots</span></h1>
          <p className="text-muted-foreground mt-2">{proyectos.length === 0 ? "Sin chatbots todavía." : `${proyectos.length} chatbot${proyectos.length === 1 ? "" : "s"}`}</p>
        </div>
        <Button asChild className="bg-gradient-to-r from-violet-500 to-blue-500 hover:opacity-90 glow-purple">
          <Link to="/nuevo"><Plus className="w-4 h-4 mr-2" /> Nuevo Chatbot</Link>
        </Button>
      </div>

      {!isLoading && proyectos.length === 0 && <EmptyState />}

      {proyectos.length > 0 && (
        <>
          <div className="relative max-w-md mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/60" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((p, i) => <ProyectoCard key={p.id} proyecto={p} index={i} onDelete={handleDelete} onDuplicate={duplicateMut.mutate} />)}
          </div>
          {filtered.length === 0 && <div className="text-center py-16 text-muted-foreground">Sin resultados para "{search}".</div>}
        </>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <div key={i} className="h-72 rounded-2xl bg-card/40 border border-border animate-pulse" />)}
        </div>
      )}
    </div>
  );
}
