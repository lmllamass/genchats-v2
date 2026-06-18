import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api/backendApi";
import { Link } from "react-router-dom";
import { ArrowLeft, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MessageBubble from "@/components/gena/MessageBubble";

const GENA_PROYECTO_ID = import.meta.env.VITE_GENA_PROYECTO_ID || "gena";

export default function Asistente() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");

    // Add user message immediately
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const visitorId = "gena_" + (user?.id || "anon");
      const res = await api.chatbotRespond({
        proyecto_id: GENA_PROYECTO_ID,
        message: text,
        visitor_id: visitorId,
        channel: "web",
      });
      const reply = res?.reply || res?.error || "Lo siento, no pude procesar tu mensaje.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error al conectar con el asistente." }]);
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center gap-3 bg-card">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="font-display font-semibold text-sm">Gena</h1>
          <p className="text-xs text-muted-foreground">Asistente de GenChat IA</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="font-display text-xl font-bold">¡Hola! Soy Gena ✨</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              Tu asistente de GenChat IA. Puedo ayudarte a crear un chatbot para tu negocio, explicarte los planes y resolver tus dudas.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} message={msg} />)
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-card">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2 max-w-3xl mx-auto"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
