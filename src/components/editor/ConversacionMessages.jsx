import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/api/backendApi";
import { Bot, User, Send, Loader2, Phone, StickyNote, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import MessageList from "@/components/inbox/MessageList";
import ConversacionNotas from "./ConversacionNotas";
import ConversacionArchivos from "./ConversacionArchivos";
import PlantillaPicker from "./PlantillaPicker";

const CANAL_LABEL = { whatsapp: "WhatsApp", web: "Web", telegram: "Telegram" };

export default function ConversacionMessages({ conversation, onTakeoverChange }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [ventanaAbierta, setVentanaAbierta] = useState(true);
  const [checkingVentana, setCheckingVentana] = useState(false);
  const [showNotas, setShowNotas] = useState(false);
  // Un solo cajón abierto a la vez: en pantallas normales no caben los dos.
  const [showArchivos, setShowArchivos] = useState(false);
  const intervalRef = useRef(null);

  const fetchMessages = useCallback(async (quiet = false) => {
    if (!conversation) return;
    if (!quiet) setLoading(true);
    try {
      // Vía backend: `conversaciones_chat` tiene la RLS cerrada a service_role — leerla
      // directo con la clave anónima exponía los chats de todos los tenants.
      const res = await api.getMessages(conversation.id, { limit: 100 });
      setMessages(res?.messages || []);
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

  // El auto-scroll lo gestiona MessageList/useAutoScroll: respeta al agente cuando está
  // leyendo hacia arriba en vez de arrastrarlo al fondo en cada poll.

  const checkVentana = useCallback(async () => {
    if (!conversation || conversation.canal !== "whatsapp" || !conversation.human_takeover) return;
    setCheckingVentana(true);
    try {
      const res = await api.getConversationVentana(conversation.id);
      setVentanaAbierta(res?.open !== false);
    } catch (_) {
      setVentanaAbierta(true); // fail-open: si no se puede comprobar, no bloquear la UI
    } finally {
      setCheckingVentana(false);
    }
  }, [conversation]);

  useEffect(() => { checkVentana(); }, [checkVentana]);

  const handleSendTemplate = async (payload) => {
    await api.sendConversationTemplate(conversation.id, payload);
    setMessages(prev => [...prev, {
      id: Date.now(), role: "assistant", content: payload.bodyPreview, created_at: new Date().toISOString(),
    }]);
    fetchMessages(true);
    checkVentana();
  };

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
      if (err.message === "ventana_cerrada") {
        toast.error("La ventana de 24h se ha cerrado — usa una plantilla para reabrir la conversación.");
        setVentanaAbierta(false);
      } else {
        toast.error("Error enviando: " + err.message);
      }
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
    <div className="flex-1 flex min-h-0">
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {conversation.canal === "whatsapp" && <Phone className="w-3 h-3 text-muted-foreground" />}
              <span className="text-sm font-semibold truncate">
                {conversation.contacto?.nombre || conversation.contacto?.telefono || conversation.visitor_id}
              </span>
              {conversation.contacto?.nombre && conversation.contacto?.telefono && (
                <span className="text-xs text-muted-foreground shrink-0">· {conversation.contacto.telefono}</span>
              )}
              <span className="text-xs text-muted-foreground">· {CANAL_LABEL[conversation.canal] || conversation.canal}</span>
            </div>
          </div>

          <button
            onClick={() => { setShowArchivos(v => !v); setShowNotas(false); }}
            title="Archivos del contacto"
            className={`p-1.5 rounded-md transition-colors shrink-0 ${showArchivos ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <button
            onClick={() => { setShowNotas(v => !v); setShowArchivos(false); }}
            title="Notas internas"
            className={`p-1.5 rounded-md transition-colors shrink-0 ${showNotas ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
          >
            <StickyNote className="w-4 h-4" />
          </button>

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
            <User className="w-3 h-3 shrink-0" />
            <span className="flex-1">Estás atendiendo tú — el bot no responderá</span>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="shrink-0 underline hover:no-underline disabled:opacity-50"
            >
              Devolver al bot
            </button>
          </div>
        )}

        {/* Messages */}
        <MessageList
          messages={messages}
          loading={loading}
          convKey={conversation ? `${conversation.proyecto_id}~${conversation.canal}~${conversation.visitor_id}` : null}
        />

        {/* Mientras responde el bot no hay composer: escribir a la vez que la IA confundiría
            al cliente. Se ofrece tomar el control de forma explícita — antes esto solo se
            podía hacer con un interruptor diminuto en la cabecera, que nadie encontraba. */}
        {!conversation.human_takeover && (
          <div className="flex items-center gap-3 px-3 py-2.5 border-t border-border bg-card/50 flex-shrink-0">
            <p className="flex-1 text-xs text-muted-foreground leading-snug">
              <Bot className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Está respondiendo el bot. Toma el control para escribir tú.
            </p>
            <Button size="sm" className="h-8 text-xs shrink-0 gap-1.5" onClick={handleToggle} disabled={toggling}>
              {toggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <User className="w-3.5 h-3.5" />}
              Responder yo
            </Button>
          </div>
        )}

        {/* Composer — solo con agente humano activo */}
        {conversation.human_takeover && (
          checkingVentana ? (
            <div className="px-3 py-2.5 border-t border-border bg-card/50 flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Comprobando ventana de conversación…
            </div>
          ) : ventanaAbierta ? (
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
          ) : (
            <PlantillaPicker proyectoId={conversation.proyecto_id} onSent={handleSendTemplate} />
          )
        )}
      </div>

      {showArchivos && <ConversacionArchivos conversation={conversation} onClose={() => setShowArchivos(false)} />}
      {showNotas && <ConversacionNotas conversation={conversation} onClose={() => setShowNotas(false)} />}
    </div>
  );
}
