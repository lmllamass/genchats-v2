import { useState, useEffect, useCallback, useRef } from "react";
import { Users, Search, Phone, Mail, Globe, MessageCircle, Send, Loader2,
  ChevronLeft, ChevronRight, Tag, X, Plus, Trash2, BookTemplate, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/api/backendApi";
import { Proyecto } from "@/api/entidades";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

const ESTADO_CFG = {
  nuevo:       { label: "Nuevo",       cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  contactado:  { label: "Contactado",  cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  interesado:  { label: "Interesado",  cls: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  cualificado: { label: "Cualificado", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  descartado:  { label: "Descartado",  cls: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  convertido:  { label: "Convertido",  cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};
const ESTADOS = Object.keys(ESTADO_CFG);

const CANAL_ICON = { whatsapp: "💬", web: "🌐", telegram: "✈️", embed: "🔗" };

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || { label: estado, cls: "bg-secondary text-muted-foreground" };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>{cfg.label}</span>;
}

export default function Leads() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // Detail panel
  const [selectedId, setSelectedId] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const [detailMessages, setDetailMessages] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Send WA state
  const [waMessage, setWaMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sending, setSending] = useState(false);

  // Lead edit state
  const [editEstado, setEditEstado] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Templates modal
  const [showTemplates, setShowTemplates] = useState(false);
  const [newTpl, setNewTpl] = useState({ name: "", content: "" });
  const [savingTpl, setSavingTpl] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Projects list for filter
  const { data: proyectos = [] } = useQuery({
    queryKey: ["proyectos", user?.id],
    queryFn: () => Proyecto.list(user.id),
    enabled: !!user?.id,
  });

  // Leads list
  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ["leads", filterStatus, filterProjectId, debouncedSearch, page],
    queryFn: () => api.listLeads({
      ...(filterProjectId ? { projectId: filterProjectId } : {}),
      ...(filterStatus ? { status: filterStatus } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      page,
      limit: LIMIT,
    }),
    enabled: !!user?.id,
  });

  const leads = leadsData?.leads || [];
  const total = leadsData?.total || 0;
  const totalPages = Math.ceil(total / LIMIT);

  // Templates
  const { data: tplData, refetch: refetchTpls } = useQuery({
    queryKey: ["lead-templates"],
    queryFn: () => api.listLeadTemplates(),
    enabled: !!user?.id,
  });
  const templates = tplData?.templates || [];

  // Load lead detail
  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    setDetailLoading(true);
    try {
      const { lead, messages } = await api.getLead(id);
      setDetailLead(lead);
      setDetailMessages(messages || []);
      setEditEstado(lead.estado || "nuevo");
      setEditNotas(lead.notas || "");
      setWaMessage("");
      setSelectedTemplate("");
    } catch (err) {
      toast.error("Error cargando lead");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else { setDetailLead(null); setDetailMessages([]); }
  }, [selectedId, loadDetail]);

  const handleSelectTemplate = (tplId) => {
    setSelectedTemplate(tplId);
    const tpl = templates.find(t => t.id === tplId);
    if (tpl) setWaMessage(tpl.content);
  };

  const handleSaveEstado = async (newEstado) => {
    if (!detailLead) return;
    setEditEstado(newEstado);
    try {
      await api.updateLead(detailLead.id, { estado: newEstado });
      refetchLeads();
    } catch (err) {
      toast.error("Error guardando estado");
    }
  };

  const handleSaveNotas = async () => {
    if (!detailLead || editNotas === detailLead.notas) return;
    setSavingNotes(true);
    try {
      await api.updateLead(detailLead.id, { notas: editNotas });
      setDetailLead(prev => ({ ...prev, notas: editNotas }));
      toast.success("Notas guardadas");
    } catch (err) {
      toast.error("Error guardando notas");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSendWA = async () => {
    if (!waMessage.trim() || !detailLead) return;
    setSending(true);
    try {
      const res = await api.sendLeadWhatsApp(detailLead.id, waMessage);
      toast.success("WhatsApp enviado");
      setWaMessage("");
      setSelectedTemplate("");
      loadDetail(detailLead.id);
      refetchLeads();
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTpl.name.trim() || !newTpl.content.trim()) return toast.error("Completa nombre y contenido");
    setSavingTpl(true);
    try {
      await api.createLeadTemplate({ ...newTpl, category: "general" });
      setNewTpl({ name: "", content: "" });
      refetchTpls();
      toast.success("Plantilla creada");
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setSavingTpl(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await api.deleteLeadTemplate(id);
      refetchTpls();
      toast.success("Plantilla eliminada");
    } catch (err) {
      toast.error("Error: " + err.message);
    }
  };

  return (
    <div className="flex h-full min-h-screen overflow-hidden">
      {/* LEFT FILTER PANEL */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-border bg-sidebar h-full sticky top-0 overflow-y-auto">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-sm">Leads</h2>
          </div>
          <p className="text-xs text-muted-foreground">{total} contacto{total !== 1 ? "s" : ""}</p>
        </div>

        <div className="p-3 space-y-4">
          {/* Status filters */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Estado</p>
            <div className="space-y-1">
              <button
                onClick={() => { setFilterStatus(""); setPage(1); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === "" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
              >
                Todos
              </button>
              {ESTADOS.map(st => (
                <button
                  key={st}
                  onClick={() => { setFilterStatus(st); setPage(1); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${filterStatus === st ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
                >
                  {ESTADO_CFG[st].label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Project filter */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Proyecto</p>
            <Select value={filterProjectId} onValueChange={(v) => { setFilterProjectId(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs bg-secondary/50">
                <SelectValue placeholder="Todos los proyectos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {proyectos.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Templates shortcut */}
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setShowTemplates(true)}>
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Plantillas WhatsApp
          </Button>
        </div>
      </aside>

      {/* CENTER — Table */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border flex-shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono o email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-secondary/50"
            />
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{total} resultados</span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {leadsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Sin leads todavía</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Los leads se capturan automáticamente desde las conversaciones del chatbot</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-sidebar border-b border-border">
                <tr>
                  {["Nombre", "Teléfono", "Canal", "Proyecto", "Estado", "Último contacto", ""].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                    className={`border-b border-border/40 cursor-pointer transition-colors hover:bg-secondary/30 ${selectedId === lead.id ? "bg-secondary/40" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground truncate max-w-[140px]">
                        {lead.nombre || <span className="text-muted-foreground italic">Anónimo</span>}
                      </div>
                      {lead.email && <div className="text-muted-foreground/60 truncate">{lead.email}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {lead.telefono ? (
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.telefono}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span title={lead.canal}>{CANAL_ICON[lead.canal] || "🌐"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[120px]">{lead.proyecto_nombre}</td>
                    <td className="px-4 py-2.5"><EstadoBadge estado={lead.estado} /></td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {lead.last_contact_at
                        ? moment(lead.last_contact_at).fromNow()
                        : lead.ultimo_mensaje
                        ? moment(lead.ultimo_mensaje).fromNow()
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {lead.telefono && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20"
                          title="Tiene teléfono — se puede enviar WhatsApp"
                        >
                          💬
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border flex-shrink-0">
            <span className="text-xs text-muted-foreground">Pág. {page} de {totalPages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7 px-2" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* RIGHT PANEL — Lead detail sheet */}
      <Sheet open={!!selectedId} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        <SheetContent side="right" className="w-[420px] sm:w-[460px] overflow-y-auto flex flex-col gap-0 p-0">
          {detailLoading || !detailLead ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-5 py-4 border-b border-border flex-shrink-0">
                <SheetHeader>
                  <SheetTitle className="text-base font-display">
                    {detailLead.nombre || "Contacto anónimo"}
                  </SheetTitle>
                </SheetHeader>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <EstadoBadge estado={editEstado} />
                  {detailLead.canal && <span className="text-xs text-muted-foreground">{CANAL_ICON[detailLead.canal]} {detailLead.canal}</span>}
                  <span className="text-xs text-muted-foreground">· {detailLead.proyecto_nombre}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* SECTION 1 — Contact info */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Datos de contacto</p>
                  <div className="rounded-xl bg-secondary/30 p-3 space-y-1.5 text-sm">
                    {detailLead.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{detailLead.email}</span>
                      </div>
                    )}
                    {detailLead.telefono && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 shrink-0" /><span>{detailLead.telefono}</span>
                      </div>
                    )}
                    {detailLead.empresa && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Globe className="w-3.5 h-3.5 shrink-0" /><span>{detailLead.empresa}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground/60 pt-1">
                      Captado {moment(detailLead.created_at).fromNow()}
                      {detailLead.whatsapp_sent_count > 0 && ` · ${detailLead.whatsapp_sent_count} mensajes enviados`}
                    </div>
                  </div>
                </div>

                {/* SECTION 2 — Status & Notes */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Estado y notas</p>
                  <Select value={editEstado} onValueChange={handleSaveEstado}>
                    <SelectTrigger className="h-8 text-xs bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map(st => (
                        <SelectItem key={st} value={st}>{ESTADO_CFG[st].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={editNotas}
                    onChange={e => setEditNotas(e.target.value)}
                    onBlur={handleSaveNotas}
                    placeholder="Notas sobre este lead…"
                    rows={3}
                    className="text-xs bg-secondary/50 resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground/50">Las notas se guardan al perder el foco</p>
                </div>

                {/* SECTION 3 — Send WhatsApp */}
                {detailLead.telefono && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> Enviar WhatsApp
                    </p>

                    <Textarea
                      value={waMessage}
                      onChange={e => setWaMessage(e.target.value)}
                      placeholder="Escribe el mensaje aquí…"
                      rows={4}
                      className="text-xs bg-secondary/50 resize-none"
                    />

                    {templates.length > 0 && (
                      <Select value={selectedTemplate} onValueChange={handleSelectTemplate}>
                        <SelectTrigger className="h-8 text-xs bg-secondary/50">
                          <SelectValue placeholder="Cargar plantilla (opcional)…" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/50">{waMessage.length} caracteres</span>
                      <Button size="sm" onClick={handleSendWA} disabled={!waMessage.trim() || sending} className="h-8">
                        {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                        Enviar
                      </Button>
                    </div>

                    {/* Send history */}
                    {detailMessages.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[10px] text-muted-foreground/70">Historial enviados</p>
                        {detailMessages.map(msg => (
                          <div key={msg.id} className="rounded-lg bg-secondary/30 px-3 py-2 text-xs">
                            <p className="text-foreground/80 leading-relaxed">{msg.message}</p>
                            <p className="text-muted-foreground/50 mt-1">{moment(msg.sent_at).format("D MMM · HH:mm")} · {msg.sent_by}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 4 — No phone warning */}
                {!detailLead.telefono && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-400">
                    Sin número de teléfono — no se puede enviar WhatsApp
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* TEMPLATES MODAL */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Plantillas WhatsApp</DialogTitle>
          </DialogHeader>

          {/* Create new */}
          <div className="space-y-3 pb-4 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground">Nueva plantilla</p>
            <Input
              placeholder="Nombre de la plantilla"
              value={newTpl.name}
              onChange={e => setNewTpl(p => ({ ...p, name: e.target.value }))}
              className="text-sm h-8 bg-secondary/50"
            />
            <Textarea
              placeholder={"Contenido del mensaje.\nPuedes usar: {{nombre}}, {{proyecto}}, {{telefono}}, {{fecha}}"}
              value={newTpl.content}
              onChange={e => setNewTpl(p => ({ ...p, content: e.target.value }))}
              rows={4}
              className="text-sm bg-secondary/50 resize-none"
            />
            <Button type="button" size="sm" disabled={savingTpl} className="w-full" onClick={handleCreateTemplate}>
              {savingTpl ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Guardar plantilla
            </Button>
          </div>

          {/* Existing templates */}
          <div className="space-y-2 pt-1">
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sin plantillas. Crea tu primera plantilla arriba.</p>
            ) : (
              templates.map(tpl => (
                <div key={tpl.id} className="flex items-start gap-3 rounded-xl bg-secondary/30 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{tpl.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">{tpl.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{tpl.content}</p>
                  </div>
                  <Button
                    size="sm" variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 h-7 w-7 p-0"
                    onClick={() => handleDeleteTemplate(tpl.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
