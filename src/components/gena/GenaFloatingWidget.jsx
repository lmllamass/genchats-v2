import { useState, useEffect, useRef, useCallback } from "react";
import { X, Send, Loader2, Sparkles, ChevronDown, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useIsMobile } from "@/hooks/use-mobile";

const API_URL = import.meta.env.VITE_API_URL || "https://api.genchats.app";

// Respuestas rápidas — se muestran solo tras el saludo inicial
const QUICK_REPLIES = [
  "¿Cómo funciona?",
  "¿Cuánto cuesta?",
  "Quiero una demo",
  "Tengo una tienda online",
];

// Mensaje de bienvenida local (no se envía al backend)
const GREETING = {
  role: "assistant",
  content:
    "¡Hola! 👋 Soy **Gena**, la asistente de **GenChats IA**.\n\nPuedo explicarte cómo crear tu chatbot de IA en minutos, resolver dudas o ayudarte a empezar con una demo. ¿En qué te puedo ayudar?",
};

// ── MessageBubble (inline, dark-themed) ────────────────────────────────────
function Bubble({ msg, isLast }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={`max-w-[82%] ${isUser ? "flex flex-col items-end" : ""}`}>
        <div
          className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
          style={
            isUser
              ? { background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff" }
              : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }
          }
        >
          {isUser ? (
            <p className="m-0 whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <ReactMarkdown
              className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              components={{
                p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                a: ({ children, ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    style={{ color: "#a5b4fc" }}
                  >
                    {children}
                  </a>
                ),
                strong: ({ children }) => (
                  <strong style={{ color: "#c7d2fe" }}>{children}</strong>
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex gap-2.5 justify-start">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
      >
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div
        className="rounded-2xl px-4 py-3"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex gap-1 items-center">
          {[0, 150, 300].map((delay) => (
            <div
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Widget principal ───────────────────────────────────────────────────────
export default function GenaFloatingWidget() {
  const isMobile = useIsMobile();

  // Persistir visitor_id en sessionStorage para continuidad en la misma sesión
  const [visitorId] = useState(() => {
    try {
      let id = sessionStorage.getItem("gena_visitor_id");
      if (!id) {
        id = "gena_" + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem("gena_visitor_id", id);
      }
      return id;
    } catch {
      return "gena_" + Math.random().toString(36).slice(2, 10);
    }
  });

  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);   // incluye GREETING como primer item al abrir
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [hasNotif, setHasNotif] = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const containerRef = useRef(null);

  // Mostrar punto de notificación tras 4 segundos si no se abrió
  useEffect(() => {
    const t = setTimeout(() => {
      if (!open) setHasNotif(true);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  // Al abrir: saludo inicial + foco en input
  useEffect(() => {
    if (open) {
      setHasNotif(false);
      if (messages.length === 0) {
        setMessages([GREETING]);
      }
      // Pequeño delay para que el DOM esté listo
      const t = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Scroll al fondo cuando llegan mensajes nuevos
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // iOS: cuando el teclado virtual aparece, el visualViewport se encoge.
  // Escuchar ese cambio y hacer scroll al input.
  useEffect(() => {
    if (!open || !isMobile) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      // Pequeño timeout para dejar que el DOM se actualice
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    };

    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [open, isMobile]);

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text?.trim();
      if (!trimmed || loading) return;

      setInput("");

      const userMsg = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        // El historial que enviamos al backend excluye el saludo local
        // y solo incluye el intercambio real de mensajes hasta ANTES del nuevo
        const apiHistory = messages
          .filter((m) => m !== GREETING && !(m.role === "assistant" && m.content === GREETING.content))
          .map((m) => ({ role: m.role, content: m.content }));

        const resp = await fetch(`${API_URL}/api/gena/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            visitor_id: visitorId,
            history: apiHistory,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "..." }]);
      } catch (e) {
        if (e.name === "AbortError" || e.name === "TimeoutError") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "La respuesta está tardando demasiado. Inténtalo de nuevo." },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Ha ocurrido un error. Inténtalo de nuevo o escríbenos a **info@genchats.app**." },
          ]);
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, visitorId]
  );

  const handleSubmit = (e) => {
    e?.preventDefault();
    sendMessage(input);
  };

  const handleQuickReply = (text) => sendMessage(text);

  const handleClose = () => setOpen(false);

  // ── Determinar si mostrar quick replies ──────────────────────────────────
  // Solo aparecen mientras solo existe el saludo (1 mensaje de Gena, sin intercambio real)
  const showQuickReplies =
    messages.length === 1 &&
    messages[0].role === "assistant" &&
    !loading;

  // ── Contenido del chat (reutilizado en móvil y desktop) ──────────────────
  const chatBody = (
    <>
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
        style={{
          background: "linear-gradient(135deg, #4338ca, #6d28d9)",
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm leading-none mb-1">Gena ✨</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-white/65 text-[11px] truncate">Asistente de GenChats IA</span>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="text-white/60 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors shrink-0"
          aria-label="Cerrar chat"
        >
          {isMobile ? <ChevronDown className="w-5 h-5" /> : <X className="w-4 h-4" />}
        </button>
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3"
        style={{ backgroundColor: "#0d1117" }}
      >
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} isLast={i === messages.length - 1} />
        ))}

        {/* Typing indicator */}
        {loading && <TypingDots />}

        {/* Quick replies — solo tras el saludo */}
        {showQuickReplies && (
          <div className="flex flex-wrap gap-2 pt-1">
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr}
                onClick={() => handleQuickReply(qr)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                style={{
                  borderColor: "rgba(99,102,241,0.45)",
                  color: "#a5b4fc",
                  background: "rgba(99,102,241,0.08)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(99,102,241,0.22)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(99,102,241,0.08)";
                  e.currentTarget.style.color = "#a5b4fc";
                }}
              >
                {qr}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        className="shrink-0 p-3 border-t"
        style={{
          backgroundColor: "#0d1117",
          borderColor: "rgba(255,255,255,0.08)",
          // Respetar safe area en iOS (notch, home bar)
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() =>
              setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 320)
            }
            placeholder="Escribe tu pregunta..."
            disabled={loading}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f1f5f9",
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)";
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
            aria-label="Enviar"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </form>
        <p className="text-center text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
          Powered by GenChats IA
        </p>
      </div>
    </>
  );

  // ── FAB (botón flotante) ──────────────────────────────────────────────────
  const fab = (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
      style={{
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        boxShadow: "0 8px 32px rgba(99,102,241,0.45), 0 2px 8px rgba(0,0,0,0.3)",
      }}
      aria-label="Abrir chat con Gena"
    >
      <MessageCircle className="w-6 h-6 text-white" />
      {hasNotif && (
        <span
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse"
          style={{ boxShadow: "0 0 0 2px #0d1117" }}
        >
          1
        </span>
      )}
    </button>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (!open) return fab;

  // MÓVIL: pantalla completa con soporte de viewport dinámico
  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex flex-col"
        style={{ backgroundColor: "#0d1117" }}
      >
        {chatBody}
      </div>
    );
  }

  // DESKTOP: ventana flotante en esquina inferior derecha
  return (
    <>
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: 390,
          height: 560,
          border: "1px solid rgba(99,102,241,0.2)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 4px 20px rgba(99,102,241,0.15)",
        }}
      >
        {chatBody}
      </div>
      {/* Mantener FAB oculto (no visible cuando open=true en desktop) */}
    </>
  );
}
