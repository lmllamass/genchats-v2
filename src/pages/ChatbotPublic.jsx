import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/api/backendApi";
import { Send, Loader2, Bot, MessageCircle } from "lucide-react";
import ChatMessage from "@/components/chatbot/ChatMessage";

const COLOR_SCHEMES = {
  azul_profesional: { primary: "#3B82F6", secondary: "#1E40AF" },
  verde_naturaleza: { primary: "#22C55E", secondary: "#15803D" },
  rojo_impacto: { primary: "#EF4444", secondary: "#B91C1C" },
  oscuro_premium: { primary: "#6366F1", secondary: "#4338CA" },
  claro_limpio: { primary: "#0EA5E9", secondary: "#0284C7" },
  naranja_energia: { primary: "#F97316", secondary: "#C2410C" },
};

function getOrCreateVisitorId() {
  // Wrapped in try-catch: localStorage throws SecurityError in cross-origin iframes
  // (Safari ITP, Firefox strict mode, etc.)
  try {
    const key = "chatbot_visitor_id";
    let vid = localStorage.getItem(key);
    if (!vid) {
      vid = "web_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(key, vid); } catch (_) {}
    }
    return vid;
  } catch (_) {
    // Fallback: ephemeral session ID (not persisted across page loads)
    return "anon_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }
}

export default function ChatbotPublic() {
  const { id } = useParams();
  const [config, setConfig] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [colorScheme, setColorScheme] = useState("azul_profesional");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const visitorId = useRef(getOrCreateVisitorId());

  useEffect(() => {
    loadConfig();
  }, [id]);

  const loadConfig = async () => {
    try {
      const data = await api.publicChatbotConfig(id);
      if (data.error) {
        setError(data.error);
      } else {
        setConfig(data);
        setProjectName(data.nombre_negocio);
        document.title = data.nombre_negocio || "Asistente Virtual";
        if (data.welcome_message) {
          setMessages([{ role: "assistant", content: data.welcome_message }]);
        }
      }
    } catch (err) {
      setError(err.message || "No se pudo cargar el chatbot");
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const data = await api.publicChatbotMessage(id, {
        action: "chat",
        message: userMsg,
        visitor_id: visitorId.current,
        channel: "web",
      });
      const reply = data?.reply || "Lo siento, no he podido procesar tu consulta.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error al enviar el mensaje. Inténtalo de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  const cs = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.azul_profesional;
  const primary = config?.color_primario || cs.primary;
  const secondary = config?.color_secundario || cs.secondary;

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "#f9fafb", color: "#1f2937" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0 shadow-sm"
        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
      >
        {config?.logo_url ? (
          <img
            src={config.logo_url}
            alt=""
            className="w-10 h-10 rounded-xl object-cover bg-white/20"
            onError={(e) => (e.target.style.display = "none")}
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate">
            {config?.nombre_negocio || projectName || "Asistente"}
          </div>
          <div className="text-white/70 text-xs">En línea</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "text-white rounded-br-md"
                  : "rounded-bl-md shadow-sm"
              }`}
              style={m.role === "user" ? { background: primary } : { backgroundColor: "#ffffff", color: "#1f2937", border: "1px solid #e5e7eb" }}
            >
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
      <div className="p-3 shrink-0" style={{ borderTop: "1px solid #e5e7eb", backgroundColor: "#ffffff" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-gray-50"
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
}
