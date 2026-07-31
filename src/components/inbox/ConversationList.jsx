import { MessageCircle, Search, User, Loader2, Globe, RotateCcw, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import moment from "moment";
import { etiquetaContacto } from "@/lib/inboxContacto";

const CANAL_ICON = {
  whatsapp: <span className="text-[11px]">💬</span>,
  web: <Globe className="w-3 h-3" />,
  telegram: <span className="text-[11px]">✈️</span>,
  phone: <Phone className="w-3 h-3" />,
};
const CANAL_FILTERS = ["todos", "whatsapp", "phone", "web", "telegram"];
const FILTRO_LABEL = { todos: "Todos", whatsapp: "WhatsApp", phone: "Voz", web: "Web", telegram: "Telegram" };

/** Panel izquierdo del inbox: buscador, filtro de canal y lista de conversaciones. */
export default function ConversationList({
  conversations, total, loading, search, onSearch,
  canalFilter, onCanalFilter, activeConv, onSelect, onRefresh,
}) {
  const esActiva = (conv) =>
    activeConv?.visitor_id === conv.visitor_id &&
    activeConv?.canal === conv.canal &&
    activeConv?.proyecto_id === conv.proyecto_id;

  return (
    <aside className="w-80 flex-shrink-0 flex flex-col border-r border-border bg-sidebar h-full">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-sm">Conversaciones</h2>
          <span className="ml-auto text-xs text-muted-foreground">{total}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar…"
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-secondary/50"
          />
        </div>
        <div className="flex gap-1">
          {CANAL_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => onCanalFilter(f)}
              className={`flex-1 text-[10px] py-1 rounded-md font-medium transition-colors ${
                canalFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {FILTRO_LABEL[f] ?? f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Sin conversaciones</p>
          </div>
        ) : conversations.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 hover:bg-sidebar-accent/60 ${
              esActiva(conv) ? "bg-sidebar-accent border-l-2 border-l-primary" : ""
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/40 to-blue-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium truncate">{etiquetaContacto(conv)}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{moment(conv.last_message_at).fromNow()}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="flex items-center gap-0.5 text-muted-foreground">{CANAL_ICON[conv.canal]}</span>
                <span className="text-[10px] text-muted-foreground truncate flex-1">{conv.last_message?.substring(0, 45) || "—"}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground/60 truncate">{conv.proyecto_nombre}</span>
                {conv.human_takeover && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 shrink-0">humano</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Actualizar
        </button>
      </div>
    </aside>
  );
}
