import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/api/supabaseClient";
import { api } from "@/api/backendApi";
import { Bot, User, Send, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import moment from "moment";

const CANAL_LABEL = { whatsapp: "WhatsApp", web: "Web", telegram: "Telegram" };

export default function ConversacionMessages({ conversation, onTakeoverChange }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [toggling, setToggling] = useState(false);
  const messagesEndRef = useRef(null);
  const intervalRef = useRef(null);

  const fetchMessages = useCallback(async (quiet = false) => {
    if (!conversation) return;
    if (!quiet) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("conversaciones_chat")
        .select("id, role, content, created_at")
        .eq("proyecto_id", conversation.proyecto_id)
        .eq("visitor_id", conversation.visitor_id)
        .eq("canal", conversation.canal)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      setMessages(data || []);
    } catch (_) {
      if (!quiet) toast.error("Error cargando mensajes");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [conversation]);

  useEffect(() => {
    setMessages([]);
    setInputText("");
    fetchMessages();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchMessages(true), 5000);
    return () => clearInterval(intervalRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleToggle = async () => {
    if (!conversation) return;
    setToggling(true);
    const newVal = !conversation.human_takeover;
    try {
      await api.setTakeover(conversation.id, newVal);
      onTakeoverChange?.({ ...conversation, human_takeover: newVal });
      toast.success(newVal ? "Agente humano activo" : "Agente IA reactivado");
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setToggling(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);
    try {
      await api.sendConversationMessage(conversation.id, text);
      setMessages(prev => [...prev, {
        id: Date.now(), role: "assistant", content: text, created_at: new Date().toISOString(),
      }]);
      fetchMessages(true);
    } catch (err) {
      toast.error("Error enviando: " + err.message);
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 text-muted-foreground">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 flex items-center justify-center mb-3">
          <Bot className="w-7 h-7 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium">Selecciona una conversación</p>
        <p className="text-xs mt-1 text-muted-foreground/70">para ver los mensajes</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {conversation.canal === "whatsapp" && <Phone className="w-3 h-3 text-muted-foreground" />}
            <span className="text-sm font-semibold truncate">{conversation.visitor_id}</span>
            <span className="text-xs text-muted-foreground">· {CANAL_LABEL[conversation.canal] || conversation.canal}</span>
          </div>
        </div>

        {/* AI toggle — WhatsApp only */}
        {conversation.canal === "whatsapp" && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Bot className="w-3 h-3" /> IA</span>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${conversation.human_takeover ? "bg-orange-500" : "bg-primary"}`}
            >
              {toggling ? (
                <Loader2 className="w-3 h-3 text-white absolute left-1/2 -translate-x-1/2 animate-spin" />
              ) : (
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${conversation.human_takeover ? "translate-x-4" : "translate-x-0.5"}`} />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Human takeover banner */}
      {conversation.human_takeover && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-orange-500/10 border-b border-orange-500/20 text-xs text-orange-400 flex-shrink-0">
          <User className="w-3 h-3" /> Modo agente humano — el bot IA no responderá
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">Sin mensajes</p>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id || i} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-secondary/70 text-foreground rounded-tl-sm"
                  : "bg-primary/20 text-foreground border border-primary/30 rounded-tr-sm"
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 text-right">{moment(msg.created_at).format("HH:mm")}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — only when human takeover */}
      {conversation.human_takeover && (
        <form onSubmit={handleSend} className="flex gap-2 px-3 py-2.5 border-t border-border bg-card/50 flex-shrink-0">
          <Input
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Escribe un mensaje…"
            className="flex-1 bg-secondary/50 text-sm h-9"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={sending}
          />
          <Button type="submit" size="sm" disabled={sending || !inputText.trim()} className="shrink-0 h-9">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      )}
    </div>
  );
}
