import { useQuery } from "@tanstack/react-query";
import { UserProfile, Proyecto } from "@/api/entidades";
import { Users, FileCode, Crown, MessageSquare } from "lucide-react";
import AdminStatsCards from "@/components/admin/AdminStatsCards";

export default function AdminDashboard() {
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => UserProfile.listAll(),
    initialData: [],
  });

  const { data: proyectos = [] } = useQuery({
    queryKey: ["admin-proyectos"],
    queryFn: () => Proyecto.listAll(),
    initialData: [],
  });

  const totalUsers = users.length;
  const totalProjects = proyectos.filter(p => p.estado === "activo" || p.estado === "pro_activo").length;
  const proProjects = proyectos.filter(p => p.estado === "pro_activo").length;
  const totalMessages = proyectos.reduce((sum, p) => sum + (p.mensajes_count || 0), 0);

  const stats = [
    { label: "Proyectos activos", value: totalProjects, icon: FileCode, gradient: "from-violet-500 to-blue-500" },
    { label: "Usuarios registrados", value: totalUsers, icon: Users, gradient: "from-emerald-500 to-cyan-500" },
    { label: "Proyectos Pro", value: proProjects, icon: Crown, gradient: "from-amber-500 to-orange-500" },
    { label: "Mensajes este mes", value: totalMessages, icon: MessageSquare, gradient: "from-pink-500 to-rose-500" },
  ];

  return (
    <div className="px-6 md:px-10 py-8 md:py-12 max-w-[1400px] mx-auto">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Administración</div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Panel <span className="gradient-text">Admin</span>
        </h1>
      </div>

      <AdminStatsCards stats={stats} />

      {/* Recent users */}
      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 mt-8">
        <h2 className="font-display text-xl font-semibold mb-4">Últimos usuarios</h2>
        <div className="space-y-3">
          {users.slice(0, 5).map(u => (
            <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  {(u.full_name || u.email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{u.full_name || u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${u.plan === "pro" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-secondary text-muted-foreground border-border"}`}>
                  {u.plan === "pro" ? "PRO" : "FREE"}
                </span>
                <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${u.role === "admin" ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-secondary text-muted-foreground border-border"}`}>
                  {u.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
