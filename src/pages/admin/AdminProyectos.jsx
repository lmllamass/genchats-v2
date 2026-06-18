import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Proyecto, UserProfile } from "@/api/entidades";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Trash2, Eye, MessageSquare, Save, Loader2, X, Phone, Bot } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "@/api/backendApi";
import ProjectDeleteDialog from "@/components/admin/ProjectDeleteDialog";

export default function AdminProyectos() {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("all");
  const [deployingId, setDeployingId] = useState(null);
  const [searchParams] = useSearchParams();
  const [filterOwner, setFilterOwner] = useState(searchParams.get("owner") || "");
  const [deleteProject, setDeleteProject] = useState(null);
  const [editingYCloud, setEditingYCloud] = useState(null);
  const [ycloudForm, setYcloudForm] = useState({ ycloud_api_key: "", ycloud_phone_number: "" });
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentNameInput, setAgentNameInput] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: proyectos = [] } = useQuery({
    queryKey: ["admin-proyectos"],
    queryFn: () => Proyecto.listAll(),
    initialData: [],
  });

  // Use backend endpoint (service role key) so all users are visible regardless of RLS
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.adminGetUsuarios(),
    initialData: [],
  });

  const deleteMut = useMutation({
    mutationFn: (id) => Proyecto.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-proyectos"] });
      setDeleteProject(null);
      toast.success("Proyecto eliminado");
    },
  });

  // Uses backend service role to bypass RLS — admin can update any project
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.adminUpdateProyecto(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-proyectos"] });
      toast.success("✅ Proyecto actualizado");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const saveYCloudMut = useMutation({
    mutationFn: ({ id }) => api.adminUpdateProyecto(id, {
      ycloud_api_key: ycloudForm.ycloud_api_key,
      ycloud_phone_number: ycloudForm.ycloud_phone_number,
      whatsapp_activo: !!(ycloudForm.ycloud_api_key && ycloudForm.ycloud_phone_number),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-proyectos"] });
      setEditingYCloud(null);
      toast.success("✅ Configuración YCloud guardada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  // Build user map by user_id (UUID)
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });

  const filtered = proyectos.filter(p => {
    const owner = userMap[p.user_id];
    const ownerName = owner?.full_name || owner?.email || "";
    const matchSearch = !search || p.nombre?.toLowerCase().includes(search.toLowerCase()) || ownerName.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filterEstado === "all" || p.estado === filterEstado;
    const matchOwner = !filterOwner || p.user_id === filterOwner;
    return matchSearch && matchEstado && matchOwner;
  });

  const getOwner = (userId) => {
    const u = userMap[userId];
    return u ? (u.full_name || u.email) : userId || "—";
  };

  const getOwnerPlan = (userId) => {
    const u = userMap[userId];
    return u?.plan || "free";
  };

  const toggleModo = (p) => {
    const newModo = p.modo_atencion === "coexistencia" ? "bot" : "coexistencia";
    updateMut.mutate({ id: p.id, data: { modo_atencion: newModo } });
  };

  const openYCloudEdit = (p) => {
    setEditingYCloud(p.id);
    setYcloudForm({
      ycloud_api_key: p.ycloud_api_key || "",
      ycloud_phone_number: p.ycloud_phone_number || "",
    });
  };

  const saveAgentName = (projectId) => {
    if (!agentNameInput.trim()) return toast.error("Introduce un nombre de agente");
    updateMut.mutate({ id: projectId, data: { agent_name: agentNameInput.trim() } });
    setEditingAgent(null);
    setAgentNameInput("");
  };

  const handleDeploy = async (projectId) => {
    setDeployingId(projectId);
    try {
      const res = await api.generarChatbot(projectId);
      if (res?.ok) {
        toast.success("✅ Chatbot generado correctamente");
        queryClient.invalidateQueries({ queryKey: ["admin-proyectos"] });
      } else {
        toast.error(res?.error || "Error al generar el chatbot");
      }
    } catch (e) {
      toast.error(e.message || "Error al generar el chatbot");
    } finally {
      setDeployingId(null);
    }
  };

  return (
    <div className="px-6 md:px-10 py-8 md:py-12 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Administración</div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            <span className="gradient-text">Proyectos</span>
          </h1>
          <p className="text-muted-foreground mt-2">{proyectos.length} proyecto{proyectos.length !== 1 ? "s" : ""} totales</p>
        </div>
        {filterOwner && (
          <Button variant="outline" size="sm" onClick={() => setFilterOwner("")}>
            <X className="w-3 h-3 mr-1" /> Quitar filtro usuario
          </Button>
        )}
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o usuario…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/60" />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-36 bg-card/60"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="pro_activo">Pro Activo</SelectItem>
            <SelectItem value="scrapeando">Scrapeando</SelectItem>
            <SelectItem value="generando">Generando</SelectItem>
            <SelectItem value="pausado">Pausado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Proyecto</th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Propietario</th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Plan</th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Agente</th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Modo</th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">WhatsApp</th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  <div className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Msgs</div>
                </th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Creado</th>
                <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const ownerPlan = getOwnerPlan(p.user_id);
                const agentStatus = p.agent_name === "pending" ? "pendiente" : p.agent_name ? "activo" : "sin agente";
                const modo = p.modo_atencion || "bot";
                const isEditingThis = editingYCloud === p.id;

                return (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.nombre}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{p.url_origen}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{getOwner(p.user_id)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${ownerPlan === "pro" || ownerPlan === "super-pro" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-secondary text-muted-foreground border-border"}`}>
                        {ownerPlan.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${
                        agentStatus === "activo" ? "bg-green-500/20 text-green-300 border-green-500/30" :
                        agentStatus === "pendiente" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                        "bg-secondary text-muted-foreground border-border"
                      }`}>
                        {agentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleModo(p)}
                        className={`px-2 py-1 rounded-full text-[10px] font-medium border cursor-pointer transition-colors ${
                          modo === "coexistencia"
                            ? "bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30"
                            : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                        }`}
                      >
                        {modo === "coexistencia" ? "🤝 Coexistencia" : "🤖 Bot"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.chatbot_config?.whatsapp_numero || p.ycloud_phone_number || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">{p.mensajes_count || 0}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.created_at ? format(new Date(p.created_at), "d MMM yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => navigate(`/editor/${p.id}`)}>
                          <Eye className="w-3 h-3 mr-1" /> Ver
                        </Button>
                        <Link to={`/admin/proyectos/${p.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-green-400 hover:text-green-300">
                            <Phone className="w-3 h-3 mr-1" /> WA
                          </Button>
                        </Link>
                        {modo === "coexistencia" && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-green-400 hover:text-green-300" onClick={() => openYCloudEdit(p)}>
                            WA
                          </Button>
                        )}
                        {agentStatus === "pendiente" && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300" onClick={() => { setEditingAgent(p.id); setAgentNameInput(`chatbot_${p.id}`); }}>
                            Activar
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost" className="h-7 px-2 text-xs text-violet-400 hover:text-violet-300"
                          title="Generar/regenerar chatbot"
                          disabled={deployingId === p.id}
                          onClick={() => handleDeploy(p.id)}
                        >
                          {deployingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteProject(p)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground">Sin resultados.</div>}
      </div>

      {/* YCloud inline editor */}
      {editingYCloud && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditingYCloud(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-lg">Configurar YCloud WhatsApp</h3>
            <p className="text-xs text-muted-foreground">Rellena los datos proporcionados por el cliente para activar WhatsApp en su proyecto.</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">API Key YCloud</label>
              <Input
                type="password"
                placeholder="Pega la API Key"
                value={ycloudForm.ycloud_api_key}
                onChange={e => setYcloudForm(prev => ({ ...prev, ycloud_api_key: e.target.value }))}
                className="bg-secondary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Número WhatsApp Business</label>
              <Input
                placeholder="+34612345678"
                value={ycloudForm.ycloud_phone_number}
                onChange={e => setYcloudForm(prev => ({ ...prev, ycloud_phone_number: e.target.value }))}
                className="bg-secondary/50"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setEditingYCloud(null)}>Cancelar</Button>
              <Button
                onClick={() => saveYCloudMut.mutate({ id: editingYCloud })}
                disabled={saveYCloudMut.isPending}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90"
              >
                {saveYCloudMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Agent name modal */}
      {editingAgent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditingAgent(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-lg">Activar agente</h3>
            <p className="text-xs text-muted-foreground">Introduce el nombre real del agente para marcar este proyecto como activo.</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nombre del agente</label>
              <Input
                placeholder="chatbot_xxx"
                value={agentNameInput}
                onChange={e => setAgentNameInput(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setEditingAgent(null)}>Cancelar</Button>
              <Button
                onClick={() => saveAgentName(editingAgent)}
                disabled={updateMut.isPending}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90"
              >
                {updateMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Activar
              </Button>
            </div>
          </div>
        </div>
      )}

      <ProjectDeleteDialog
        project={deleteProject}
        open={!!deleteProject}
        onClose={() => setDeleteProject(null)}
        onConfirm={(id) => deleteMut.mutate(id)}
        deleting={deleteMut.isPending}
      />
    </div>
  );
}
