import { useState, useEffect, useCallback } from "react";
import { api } from "@/api/backendApi";
import { StickyNote, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import moment from "moment";

export default function ConversacionNotas({ conversation, onClose }) {
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);

  const fetchNotas = useCallback(async () => {
    if (!conversation) return;
    try {
      const res = await api.listConversationNotas(conversation.id);
      setNotas(res?.notas || []);
    } catch (_) {
      toast.error("Error cargando notas");
    } finally {
      setLoading(false);
    }
  }, [conversation]);

  useEffect(() => { setLoading(true); fetchNotas(); }, [fetchNotas]);

  const handleAdd = async () => {
    if (!texto.trim() || sending) return;
    setSending(true);
    try {
      await api.addConversationNota(conversation.id, texto.trim());
      setTexto("");
      fetchNotas();
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (notaId) => {
    try {
      await api.deleteConversationNota(conversation.id, notaId);
      setNotas(prev => prev.filter(n => n.id !== notaId));
    } catch (err) {
      toast.error("Error: " + err.message);
    }
  };

  return (
    <div className="w-72 border-l border-border bg-card/30 flex flex-col min-h-0 flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5" /> Notas internas
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : notas.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6">Sin notas todavía — solo las ve el equipo, nunca el cliente.</p>
        ) : (
          notas.map(n => (
            <div key={n.id} className="rounded-lg bg-secondary/40 border border-border p-2.5 group">
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{n.contenido}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">{n.autor_nombre || "Operador"} · {moment(n.created_at).format("DD/MM HH:mm")}</span>
                <button onClick={() => handleDelete(n.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-2.5 border-t border-border flex-shrink-0 space-y-1.5">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Añade un recordatorio para ti o para quien abra este chat…"
          rows={3}
          className="w-full text-xs px-2.5 py-2 rounded-lg bg-secondary/50 border border-border resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button size="sm" className="w-full h-7 text-xs" onClick={handleAdd} disabled={!texto.trim() || sending}>
          {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Añadir nota"}
        </Button>
      </div>
    </div>
  );
}
