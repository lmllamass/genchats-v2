import { useState, useRef, useEffect } from "react";
import { api } from "@/api/backendApi";
import { Send, Loader2, Bot, X, MessageCircle } from "lucide-react";
import { COLOR_SCHEMES } from "@/lib/templates";
import ChatMessage from "@/components/chatbot/ChatMessage";

function getOrCreateVisitorId(proyectoId) {
  const key = "chatbot_visitor_" + proyectoId;
  let vid = localStorage.getItem(key);
  if (!vid) {
    vid = "test_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(key, vid);
  }
  return vid;
}

export default function ChatbotWidget({ proyecto, embedded = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(embedded);
  const scrollRef = useRef(null);
  const visitorId = useRef(getOrCreateVisitorId(proyecto?.id));

  const config = proyecto?.chatbot_config || {};
  const cs = COLOR_SCHEMES[proyecto?.esquema_color] || COLOR_SCHEMES.azul_profesional;
  const primary = config.color_primario || cs.primary;
  const secondary = config.color_secundario || cs.secondary;

  useEffect(() => {
    if (config.welcome_message && messages.length === 0) {
      setMessages([{ role: "assistant", content: config.welcome_message }]);
    }
  }, [config.welcome_message]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await api.chatbotRespond({
        proyecto_id: proyecto.id,
        message: userMsg,
        visitor_id: visitorId.current,
        channel: "web",
      });
      setMessages(prev => [...prev, { role: "assistant", content: res.reply || res.error || "Error al procesar." }]);
    } catch (e) {
      const errMsg = e?.message || "Lo siento, no he podido procesar tu consulta. Inténtalo de nuevo.";
      setMessages(prev => [...prev, { role: "assistant", content: errMsg }]);
    }
    setLoading(false);
  };

  const chatPanel = (
    <div className="flex flex-col" style={{ height: embedded ? "600px" : "480px", width: embedded ? "100%" : "380px" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
        {config.logo_url ? (
          <img src={config.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover bg-white/20" onError={e => e.target.style.display = 'none'} />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{config.nombre_negocio || proyecto?.nombre || "Asistente"}</div>
          <div className="text-white/70 text-xs">En línea</div>
        </div>
        {!embedded && (
          <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === "user"
                ? "text-white rounded-br-md"
                : "bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm"
            }`} style={m.role === "user" ? { background: primary } : {}}>
              {m.role === "user" ? m.content : <ChatMessage content={m.content} />}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white shrink-0">
        <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
            style={{ color: "#1f2937", backgroundColor: "#f9fafb" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40 transition-opacity"
            style={{ background: primary }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xl bg-white">
        {chatPanel}
      </div>
    );
  }

  return (
    <>
      {open ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white animate-in slide-in-from-bottom-4">
          {chatPanel}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
          style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}
    </>
  );
}
