import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/api/supabaseClient";
import { api } from "@/api/backendApi";
import { Search, User, Loader2, RotateCcw, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

const CANAL_ICON = { whatsapp: "💬", web: "🌐", telegram: "✈️" };

export default function ConversacionesPanel({ proyectoId, activeConv, onSelect }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const intervalRef = useRef(null);

  const fetchConversations = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      // Query conversaciones_chat grouped by visitor_id+canal
      const { data: msgs, error } = await supabase
        .from("conversaciones_chat")
        .select("visitor_id, canal, content, role, created_at")
        .eq("proyecto_id", proyectoId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      // Group: last message per (visitor_id, canal)
      const map = {};
      for (const m of msgs || []) {
        const key = `${m.visitor_id}__${m.canal}`;
        if (!map[key]) {
          map[key] = {
            id: `${proyectoId}~${m.canal}~${m.visitor_id}`,
            visitor_id: m.visitor_id,
            canal: m.canal,
            proyecto_id: proyectoId,
            last_message: m.content,
            last_role: m.role,
            last_message_at: m.created_at,
            human_takeover: false,
          };
        }
      }

      // Get takeover states
      const { data: states } = await supabase
        .from("conversaciones")
        .select("visitor_id, canal, human_takeover")
        .eq("proyecto_id", proyectoId);

      for (const s of states || []) {
        const key = `${s.visitor_id}__${s.canal}`;
        if (map[key]) map[key].human_takeover = s.human_takeover || false;
      }

      const sorted = Object.values(map).sort(
        (a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)
      );
      setConversations(sorted);
    } catch (_) {
      if (!quiet) toast.error("Error cargando conversaciones");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    fetchConversations();
    intervalRef.current = setInterval(() => fetchConversations(true), 5000);
    return () => clearInterval(intervalRef.current);
  }, [fetchConversations]);

  // Sync takeover state when activeConv changes (e.g. after toggle)
  useEffect(() => {
    if (!activeConv) return;
    setConversations(prev =>
      prev.map(c =>
        c.visitor_id === activeConv.visitor_id && c.canal === activeConv.canal
          ? { ...c, human_takeover: activeConv.human_takeover }
          : c
      )
    );
  }, [activeConv?.human_takeover]);

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.visitor_id?.toLowerCase().includes(q) || c.last_message?.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-secondary/50"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-10 px-4">
            <MessageCircle className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Sin conversaciones aún</p>
          </div>
        ) : (
          filtered.map(conv => {
            const isActive =
              activeConv?.visitor_id === conv.visitor_id && activeConv?.canal === conv.canal;
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-border/40 hover:bg-sidebar-accent/60 ${isActive ? "bg-sidebar-accent border-l-2 border-l-primary" : ""}`}
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium truncate">{conv.visitor_id}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{moment(conv.last_message_at).fromNow()}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-muted-foreground">{CANAL_ICON[conv.canal] || "💬"}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{conv.last_message?.substring(0, 38) || "—"}</span>
                  </div>
                  {conv.human_takeover && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">agente humano</span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Refresh footer */}
      <div className="p-2 border-t border-border">
        <button onClick={() => fetchConversations()} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          <RotateCcw className="w-3 h-3" /> Actualizar
        </button>
      </div>
    </div>
  );
}
