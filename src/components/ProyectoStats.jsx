import { useQuery } from "@tanstack/react-query";
import { Lead } from "@/api/entidades";
import { MessageSquare, UserCheck } from "lucide-react";

export default function ProyectoStats({ proyectoId }) {
  const { data: leads = [] } = useQuery({
    queryKey: ["leads-stats", proyectoId],
    queryFn: () => Lead.list(proyectoId),
    initialData: [],
  });

  const totalConsultas = leads.reduce((sum, l) => sum + (l.mensajes_count || 0), 0);
  const conDatos = leads.filter(l => l.email || l.telefono).length;

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary">
        <MessageSquare className="w-3 h-3 text-violet-400" />
        <span className="text-muted-foreground">{totalConsultas} consultas</span>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary">
        <UserCheck className="w-3 h-3 text-emerald-400" />
        <span className="text-muted-foreground">{conDatos} contactos</span>
      </div>
    </div>
  );
}
