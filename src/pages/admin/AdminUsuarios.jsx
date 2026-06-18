import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { UserProfile, Proyecto } from "@/api/entidades";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Pencil, Trash2, UserPlus, Loader2, FileCode, Send } from "lucide-react";
import { api } from "@/api/backendApi";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import UserEditDialog from "@/components/admin/UserEditDialog.jsx";
import UserDeleteDialog from "@/components/admin/UserDeleteDialog.jsx";

export default function AdminUsuarios() {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Use backend endpoint (service role key) so all users are visible regardless of RLS
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.adminGetUsuarios(),
    initialData: [],
  });

  const { data: proyectos = [] } = useQuery({
    queryKey: ["admin-proyectos"],
    queryFn: () => Proyecto.listAll(),
    initialData: [],
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.adminUpdateUsuario(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditUser(null);
      toast.success("✅ Usuario actualizado");
    },
    onError: (e) => toast.error("Error al guardar: " + e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.adminUpdateUsuario(id, { estado: "inactivo" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteUser(null);
      toast.success("✅ Usuario desactivado");
    },
    onError: (e) => toast.error("Error al desactivar: " + e.message),
  });

  const handleSaveUser = (userId, data) => {
    updateMut.mutate({ id: userId, data });
  };

  const handleInvite = async (emailArg) => {
    const email = (emailArg || inviteEmail).trim();
    if (!email) return toast.error("Escribe un email antes de enviar");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Formato de email inválido");
    setInviting(true);
    try {
      await api.adminInviteUser(email);
      setInviteEmail("");
      toast.success(`✉️ Invitación enviada a ${email}`, { duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("already been registered") || msg.includes("email_exists")) {
        toast.info(`El usuario ${email} ya existe — se le ha enviado un enlace para entrar.`);
        setInviteEmail("");
      } else {
        toast.error("Error al enviar invitación: " + (msg || "Inténtalo de nuevo"));
      }
    } finally {
      setInviting(false);
    }
  };

  const handleTogglePlan = (user) => {
    const newPlan = user.plan === "pro" ? "free" : "pro";
    const data = { plan: newPlan };
    if (newPlan === "pro") data.plan_activated_at = new Date().toISOString();
    updateMut.mutate({ id: user.id, data });
  };

  // Count projects per user_id
  const projectCountMap = {};
  proyectos.forEach(p => {
    if (p.user_id) projectCountMap[p.user_id] = (projectCountMap[p.user_id] || 0) + 1;
  });

  const filtered = users.filter(u => {
    const matchSearch = !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchPlan = filterPlan === "all" || u.plan === filterPlan;
    return matchSearch && matchPlan;
  });

  const handleViewProjects = (userId) => {
    navigate(`/admin/proyectos?owner=${encodeURIComponent(userId)}`);
  };

  return (
    <div className="px-6 md:px-10 py-8 md:py-12 max-w-[1400px] mx-auto">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Administración</div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          <span className="gradient-text">Usuarios</span>
        </h1>
        <p className="text-muted-foreground mt-2">{users.length} usuario{users.length !== 1 ? "s" : ""} registrados</p>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 mb-6">
        <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Invitar usuario</h3>
        <div className="flex gap-3 flex-wrap">
          <Input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleInvite(e.currentTarget.value); } }}
            placeholder="email@ejemplo.com"
            className="bg-secondary/50 border-border max-w-sm"
            disabled={inviting}
            autoComplete="off"
          />
          <Button onClick={() => handleInvite(inviteEmail)} disabled={inviting} className="bg-gradient-to-r from-violet-500 to-blue-500 hover:opacity-90">
            {inviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {inviting ? "Enviando…" : "Enviar invitación"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">El usuario recibirá un email con un enlace para establecer su contraseña y acceder a la plataforma.</p>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/60" />
        </div>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-32 bg-card/60"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Usuario</th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Registro</th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Proyectos</th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Plan</th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Estado</th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {(u.full_name || u.email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{u.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.created_at ? format(new Date(u.created_at), "d MMM yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono">{projectCountMap[u.id] || 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${u.plan === "pro" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-secondary text-muted-foreground border-border"}`}>
                      {u.plan === "pro" ? "PRO" : "FREE"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${u.role === "admin" ? "bg-red-500/20 text-red-300 border-red-500/30" : u.estado === "inactivo" ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-green-500/20 text-green-300 border-green-500/30"}`}>
                      {u.estado === "inactivo" ? "Inactivo" : "Activo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleViewProjects(u.id)} title="Ver proyectos">
                        <FileCode className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleTogglePlan(u)} title={u.plan === "pro" ? "Cambiar a Free" : "Cambiar a Pro"}>
                        {u.plan === "pro" ? "→Free" : "→Pro"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditUser(u)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteUser(u)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground">Sin resultados.</div>}
      </div>

      <UserEditDialog user={editUser} open={!!editUser} onClose={() => setEditUser(null)} onSave={handleSaveUser} saving={updateMut.isPending} />
      <UserDeleteDialog user={deleteUser} open={!!deleteUser} onClose={() => setDeleteUser(null)} onConfirm={(id) => deleteMut.mutate(id)} deleting={deleteMut.isPending} />
    </div>
  );
}
