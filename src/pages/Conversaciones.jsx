import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  MessageCircle, Search, Bot, User, Send, Loader2, ArrowLeft,
  Globe, Phone, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/api/backendApi";
import { toast } from "sonner";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

const CANAL_LABEL = { whatsapp: "WhatsApp", web: "Web", telegram: "Telegram" };
const CANAL_ICON = {
  whatsapp: <span className="text-[11px]">💬</span>,
  web: <Globe className="w-3 h-3" />,
  telegram: <span className="text-[11px]">✈️</span>,
};
const CANAL_FILTERS = ["todos", "whatsapp", "web", "telegram"];

function encodeConvId(proyecto_id, canal, visitor_id) {
  return `${proyecto_id}~${canal}~${visitor_id}`;
}

export default function Conversaciones() {
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [canalFilter, setCanalFilter] = useState("todos");
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [togglingTakeover, setTogglingTakeover] = useState(false);
  const messagesEndRef = useRef(null);
  const intervalRef = useRef(null);

  const fetchConversations = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const params = { limit: 50 };
      if (canalFilter !== "todos") params.canal = canalFilter;
      const data = await api.listConversations(params);
      setConversations(data.conversations || []);
      setTotal(data.total || 0);
    } catch (err) {
      if (!quiet) toast.error("Error cargando conversaciones");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [canalFilter]);

  const fetchMessages = useCallback(async (conv, quiet = false) => {
    if (!conv) return;
    if (!quiet) setMessagesLoading(true);
    try {
      const id = encodeConvId(conv.proyecto_id, conv.canal, conv.visitor_id);
      const data = await api.getMessages(id, { limit: 100 });
      setMessages(data.messages || []);
      // Sync takeover state in case it changed
      setActiveConv(prev =>
        prev && prev.visitor_id === conv.visitor_id && prev.canal === conv.canal && prev.proyecto_id === conv.proyecto_id
          ? { ...prev, human_takeover: data.human_takeover }
          : prev
      );
    } catch (err) {
      if (!quiet) toast.error("Error cargando mensajes");
    } finally {
      if (!quiet) setMessagesLoading(false);
    }
  }, []);

  // Initial load + filter changes
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchConversations(true);
      if (activeConv) fetchMessages(activeConv, true);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, [fetchConversations, fetchMessages, activeConv]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectConv = (conv) => {
    setActiveConv(conv);
    setMessages([]);
    setInputText("");
    fetchMessages(conv);
  };

  const handleToggleTakeover = async () => {
    if (!activeConv) return;
    setTogglingTakeover(true);
    const newVal = !activeConv.human_takeover;
    try {
      const id = encodeConvId(activeConv.proyecto_id, activeConv.canal, activeConv.visitor_id);
      await api.setTakeover(id, newVal);
      setActiveConv(prev => ({ ...prev, human_takeover: newVal }));
      setConversations(prev =>
        prev.map(c =>
          c.visitor_id === activeConv.visitor_id && c.canal === activeConv.canal && c.proyecto_id === activeConv.proyecto_id
            ? { ...c, human_takeover: newVal }
            : c
        )
      );
      toast.success(newVal ? "Agente humano activo" : "Agente IA reactivado");
    } catch (err) {
      toast.error("Error cambiando modo: " + err.message);
    } finally {
      setTogglingTakeover(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !activeConv || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);
    try {
      const id = encodeConvId(activeConv.proyecto_id, activeConv.canal, activeConv.visitor_id);
      await api.sendConversationMessage(id, text);
      // Optimistic add
      setMessages(prev => [...prev, { id: Date.now(), role: "assistant", content: text, created_at: new Date().toISOString() }]);
      // Refresh to confirm
      fetchMessages(activeConv, true);
    } catch (err) {
      toast.error("Error enviando: " + err.message);
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.visitor_id?.toLowerCase().includes(q) || c.last_message?.toLowerCase().includes(q) || c.proyecto_nombre?.toLowerCase().includes(q);
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* LEFT PANEL */}
      <aside className="w-80 flex-shrink-0 flex flex-col border-r border-border bg-sidebar h-full">
        {/* Header */}
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
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-secondary/50"
            />
          </div>
          {/* Canal filter */}
          <div className="flex gap-1">
            {CANAL_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setCanalFilter(f)}
                className={`flex-1 text-[10px] py-1 rounded-md font-medium transition-colors capitalize ${
                  canalFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Sin conversaciones</p>
            </div>
          ) : (
            filtered.map(conv => {
              const isActive =
                activeConv?.visitor_id === conv.visitor_id &&
                activeConv?.canal === conv.canal &&
                activeConv?.proyecto_id === conv.proyecto_id;
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConv(conv)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 hover:bg-sidebar-accent/60 ${isActive ? "bg-sidebar-accent border-l-2 border-l-primary" : ""}`}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/40 to-blue-500/40 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium truncate">{conv.visitor_id}</span>
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
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <button
            onClick={() => fetchConversations()}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Actualizar
          </button>
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="font-display font-semibold text-foreground mb-1">Selecciona una conversación</h3>
            <p className="text-sm text-muted-foreground">para ver los mensajes y gestionar el agente</p>
            <Link to="/app" className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al dashboard
            </Link>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card/50 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/40 to-blue-500/40 flex items-center justify-center">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {activeConv.canal === "whatsapp" && <Phone className="w-3 h-3 text-muted-foreground" />}
                  <span className="text-sm font-semibold truncate">{activeConv.visitor_id}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {CANAL_ICON[activeConv.canal]}
                    {CANAL_LABEL[activeConv.canal] || activeConv.canal}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{activeConv.proyecto_nombre}</p>
              </div>

              {/* AI / Human toggle — WhatsApp only */}
              {activeConv.canal === "whatsapp" && (
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5" /> Agente IA
                  </span>
                  <button
                    onClick={handleToggleTakeover}
                    disabled={togglingTakeover}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      activeConv.human_takeover ? "bg-orange-500" : "bg-primary"
                    }`}
                    aria-label="Toggle AI agent"
                  >
                    {togglingTakeover ? (
                      <Loader2 className="w-3 h-3 text-white absolute left-1/2 -translate-x-1/2 animate-spin" />
                    ) : (
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          activeConv.human_takeover ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Human takeover banner */}
            {activeConv.human_takeover && (
              <div className="flex items-center gap-2 px-5 py-2 bg-orange-500/10 border-b border-orange-500/20 text-xs text-orange-400 flex-shrink-0">
                <User className="w-3.5 h-3.5" />
                Modo agente humano activo — el chatbot IA no responderá en esta conversación
              </div>
            )}

            {/* Message history */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground">Sin mensajes</div>
              ) : (
                messages.map((msg, i) => (
                  <div key={msg.id || i} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-secondary/60 text-foreground rounded-tl-sm"
                          : "bg-primary/20 text-foreground border border-primary/30 rounded-tr-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1 text-right">
                        {moment(msg.created_at).format("HH:mm")}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input — only when human takeover is active */}
            {activeConv.human_takeover && (
              <form
                onSubmit={handleSend}
                className="flex items-end gap-2 px-4 py-3 border-t border-border bg-card/50 flex-shrink-0"
              >
                <Input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Escribe un mensaje…"
                  className="flex-1 bg-secondary/50 text-sm"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  disabled={sending}
                />
                <Button type="submit" size="sm" disabled={sending || !inputText.trim()} className="shrink-0">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}
