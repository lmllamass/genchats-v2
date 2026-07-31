import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, User, ArrowLeft } from "lucide-react";
import { api } from "@/api/backendApi";
import { toast } from "sonner";
import "moment/locale/es";
import moment from "moment";
import ConversationList from "@/components/inbox/ConversationList";
import ConversationHeader from "@/components/inbox/ConversationHeader";
import MessageList from "@/components/inbox/MessageList";
import Composer from "@/components/inbox/Composer";
import NotesPanel from "@/components/inbox/NotesPanel";
moment.locale("es");

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
  const [ultimoEntranteAt, setUltimoEntranteAt] = useState(null);
  const [togglingTakeover, setTogglingTakeover] = useState(false);
  const [plantillas, setPlantillas] = useState([]);
  const [plantillasLoading, setPlantillasLoading] = useState(false);
  const [showNotas, setShowNotas] = useState(false);
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
      const entrantes = data.messages || [];
      // Estabilidad referencial: el polling cada 5s traía un array nuevo aunque el contenido
      // fuese idéntico, lo que re-renderizaba la lista sin necesidad. Solo actualizamos si
      // algo cambió de verdad.
      setMessages(prev => (
        prev.length === entrantes.length &&
        prev.every((m, i) => m.id === entrantes[i].id && m.content === entrantes[i].content)
          ? prev
          : entrantes
      ));
      setUltimoEntranteAt(data.ultimo_entrante_at || null);
      // Sync takeover + contacto resuelto (en voz el visitor_id es un call_id opaco)
      setActiveConv(prev =>
        prev && prev.visitor_id === conv.visitor_id && prev.canal === conv.canal && prev.proyecto_id === conv.proyecto_id
          ? { ...prev, human_takeover: data.human_takeover, contacto: data.contacto ?? prev.contacto ?? null }
          : prev
      );
    } catch (err) {
      if (!quiet) toast.error("Error cargando mensajes");
    } finally {
      if (!quiet) setMessagesLoading(false);
    }
  }, []);

  const fetchPlantillas = useCallback(async (conv) => {
    if (!conv) return;
    setPlantillasLoading(true);
    try {
      const id = encodeConvId(conv.proyecto_id, conv.canal, conv.visitor_id);
      const data = await api.listConversationPlantillas(id);
      setPlantillas(data.plantillas || []);
    } catch (_) {
      setPlantillas([]);
    } finally {
      setPlantillasLoading(false);
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

  // El auto-scroll vive en MessageList/useAutoScroll: aquí no se toca el scroll.

  const handleSelectConv = (conv) => {
    setActiveConv(conv);
    setMessages([]);
    setUltimoEntranteAt(null);
    setShowNotas(false);
    fetchMessages(conv);
    fetchPlantillas(conv);
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

  const convId = activeConv
    ? encodeConvId(activeConv.proyecto_id, activeConv.canal, activeConv.visitor_id)
    : null;

  // Devuelve/propaga el error para que el Composer conserve el texto si falla el envío.
  const handleSendText = async (text) => {
    if (!activeConv) return;
    try {
      await api.sendConversationMessage(convId, text);
      setMessages(prev => [...prev, {
        id: `tmp-${Date.now()}`, role: "assistant", content: text, created_at: new Date().toISOString(),
      }]);
      fetchMessages(activeConv, true);
    } catch (err) {
      toast.error("Error enviando: " + (err.message === "ventana_cerrada"
        ? "la ventana de 24 h está cerrada, usa una plantilla"
        : err.message));
      throw err;
    }
  };

  const handleSendPlantilla = async (plantilla, valores) => {
    if (!activeConv) return;
    try {
      await api.sendConversationTemplate(convId, {
        name: plantilla.wa_template_name,
        language: plantilla.wa_language,
        contenido: plantilla.contenido,
        valores,
      });
      toast.success("Plantilla enviada");
      fetchMessages(activeConv, true);
    } catch (err) {
      toast.error("Error enviando la plantilla: " + err.message);
      throw err;
    }
  };

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.visitor_id?.toLowerCase().includes(q) || c.last_message?.toLowerCase().includes(q) || c.proyecto_nombre?.toLowerCase().includes(q);
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ConversationList
        conversations={filtered}
        total={total}
        loading={loading}
        search={search}
        onSearch={setSearch}
        canalFilter={canalFilter}
        onCanalFilter={setCanalFilter}
        activeConv={activeConv}
        onSelect={handleSelectConv}
        onRefresh={() => fetchConversations()}
      />

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
            <ConversationHeader
              conv={activeConv}
              showNotas={showNotas}
              onToggleNotas={() => setShowNotas(v => !v)}
              onToggleTakeover={handleToggleTakeover}
              togglingTakeover={togglingTakeover}
            />

            {/* Human takeover banner */}
            {activeConv.human_takeover && (
              <div className="flex items-center gap-2 px-5 py-2 bg-orange-500/10 border-b border-orange-500/20 text-xs text-orange-400 flex-shrink-0">
                <User className="w-3.5 h-3.5" />
                Modo agente humano activo — el chatbot IA no responderá en esta conversación
              </div>
            )}

            {/* Mensajes + notas */}
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 flex flex-col min-w-0">
                <MessageList
                  messages={messages}
                  loading={messagesLoading}
                  convKey={convId}
                />

                {/* Composer — solo con el agente humano al mando */}
                {activeConv.human_takeover && (
                  <Composer
                    convKey={convId}
                    canal={activeConv.canal}
                    ultimoEntranteAt={ultimoEntranteAt}
                    plantillas={plantillas}
                    plantillasLoading={plantillasLoading}
                    onEnviarTexto={handleSendText}
                    onEnviarPlantilla={handleSendPlantilla}
                  />
                )}
              </div>

              {showNotas && (
                <aside className="w-80 flex-shrink-0 border-l border-border bg-card/30">
                  <NotesPanel convId={convId} />
                </aside>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
