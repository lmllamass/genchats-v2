import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { api } from "@/api/backendApi";
import { Search, User, Loader2, MessageCircle, RotateCcw, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import ConversacionMessages from "@/components/editor/ConversacionMessages";
import { toast } from "sonner";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

const CANAL_ICON = { whatsapp: "💬", web: "🌐", telegram: "✈️" };
const CANAL_FILTERS = ["todos", "whatsapp", "web", "telegram"];

/**
 * Bandeja de entrada a pantalla completa para cuentas de tipo 'operadora'.
 *
 * A diferencia de ConversacionesPanel (que es de UN proyecto, dentro del Editor), aquí se
 * mezclan las conversaciones de TODOS los proyectos que la operadora atiende — puede estar
 * asignada a varios números/delegaciones. El backend ya devuelve solo lo accesible.
 */
export default function OperadoraInbox() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [canal, setCanal] = useState("todos");
  const [proyectoFiltro, setProyectoFiltro] = useState("todos");
  const [activeConv, setActiveConv] = useState(null);
  const intervalRef = useRef(null);

  const fetchConversations = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const params = { limit: 200 };
      if (canal !== "todos") params.canal = canal;
      const res = await api.listConversations(params);
      setConversations(res?.conversations || []);
    } catch (err) {
      if (!quiet) toast.error("Error cargando conversaciones");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [canal]);

  useEffect(() => {
    fetchConversations();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchConversations(true), 5000);
    return () => clearInterval(intervalRef.current);
  }, [fetchConversations]);

  // Los proyectos salen de las propias conversaciones: si solo atiende uno, no se muestra
  // el filtro (sería ruido).
  const proyectos = useMemo(() => {
    const map = new Map();
    for (const c of conversations) {
      if (!map.has(c.proyecto_id)) map.set(c.proyecto_id, c.proyecto_nombre || "Proyecto");
    }
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [conversations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter(c => {
      if (proyectoFiltro !== "todos" && c.proyecto_id !== proyectoFiltro) return false;
      if (!q) return true;
      return c.visitor_id?.toLowerCase().includes(q) || c.last_message?.toLowerCase().includes(q);
    });
  }, [conversations, search, proyectoFiltro]);

  // Mantiene sincronizado el estado de takeover de la fila seleccionada
  const handleTakeoverChange = (updated) => {
    setActiveConv(updated);
    setConversations(prev => prev.map(c => c.id === updated.id ? { ...c, human_takeover: updated.human_takeover } : c));
  };

  const pendientes = filtered.filter(c => c.last_role === "user").length;

  return (
    <div className="flex-1 flex min-h-0">
      {/* Lista — se oculta en móvil cuando hay una conversación abierta */}
      <aside className={`w-full md:w-80 border-r border-border flex flex-col min-h-0 flex-shrink-0 ${activeConv ? "hidden md:flex" : "flex"}`}>
        <div className="p-3 border-b border-border space-y-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por teléfono o mensaje…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs bg-secondary/50"
            />
          </div>

          <div className="flex gap-1">
            {CANAL_FILTERS.map(c => (
              <button
                key={c}
                onClick={() => setCanal(c)}
                className={`flex-1 text-[11px] py-1.5 rounded-md capitalize transition-colors ${
                  canal === c ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                {c === "todos" ? "Todos" : CANAL_ICON[c]}
              </button>
            ))}
          </div>

          {proyectos.length > 1 && (
            <select
              value={proyectoFiltro}
              onChange={e => setProyectoFiltro(e.target.value)}
              className="w-full h-8 text-xs rounded-md bg-secondary/50 border border-border px-2"
            >
              <option value="todos">Todos los proyectos</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          )}

          <p className="text-[10px] text-muted-foreground">
            {filtered.length} conversación{filtered.length === 1 ? "" : "es"}
            {pendientes > 0 && <span className="text-amber-400"> · {pendientes} esperando respuesta</span>}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageCircle className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Sin conversaciones</p>
            </div>
          ) : (
            filtered.map(conv => {
              const isActive = activeConv?.id === conv.id;
              const esperando = conv.last_role === "user";
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-border/40 hover:bg-sidebar-accent/60 ${isActive ? "bg-sidebar-accent border-l-2 border-l-primary" : ""}`}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium truncate">{conv.visitor_id}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{moment(conv.last_message_at).fromNow(true)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-muted-foreground">{CANAL_ICON[conv.canal] || "💬"}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{conv.last_message?.substring(0, 40) || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {proyectos.length > 1 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground truncate max-w-[130px]">
                          {conv.proyecto_nombre}
                        </span>
                      )}
                      {esperando && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">esperando</span>
                      )}
                      {conv.human_takeover && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">tú atiendes</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="p-2 border-t border-border flex-shrink-0">
          <button onClick={() => fetchConversations()} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3 h-3" /> Actualizar
          </button>
        </div>
      </aside>

      {/* Conversación */}
      <div className={`flex-1 flex flex-col min-h-0 ${activeConv ? "flex" : "hidden md:flex"}`}>
        {activeConv && (
          <button
            onClick={() => setActiveConv(null)}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground border-b border-border"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a la lista
          </button>
        )}
        <ConversacionMessages conversation={activeConv} onTakeoverChange={handleTakeoverChange} />
      </div>
    </div>
  );
}
