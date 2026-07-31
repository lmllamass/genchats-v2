import { useEffect, useState } from "react";
import { StickyNote, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/api/backendApi";
import moment from "moment";

/**
 * Notas internas de la conversación (no visibles para el cliente).
 *
 * Append-only y con guardado explícito: nada de debounce silencioso. Con varios agentes,
 * un campo único sobrescribible haría que el segundo pisara lo del primero sin enterarse.
 */
export default function NotesPanel({ convId }) {
  const [notas, setNotas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState("idle");   // idle | guardando | guardada | error

  useEffect(() => {
    if (!convId) return;
    let vigente = true;
    setCargando(true);
    setError(null);
    setTexto("");
    setEstado("idle");
    api.listConversationNotas(convId)
      .then(d => { if (vigente) setNotas(d.notas || []); })
      .catch(err => { if (vigente) setError(err.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [convId]);

  const añadir = async () => {
    const limpio = texto.trim();
    if (!limpio || estado === "guardando") return;
    setEstado("guardando");
    try {
      const { nota } = await api.createConversationNota(convId, limpio);
      setNotas(prev => [nota, ...prev]);
      setTexto("");
      setEstado("guardada");
      setTimeout(() => setEstado(s => (s === "guardada" ? "idle" : s)), 2500);
    } catch (err) {
      setError(err.message);
      setEstado("error");
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
        <StickyNote className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold">Notas internas</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">Solo para el equipo</span>
      </div>

      {/* Alta de nota */}
      <div className="px-4 py-3 border-b border-border space-y-2 flex-shrink-0">
        <Textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribe una nota sobre esta conversación…"
          rows={3}
          className="text-xs bg-secondary/50 resize-none"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={añadir} disabled={!texto.trim() || estado === "guardando"} className="h-7 text-xs">
            {estado === "guardando" ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Guardando…</> : "Añadir nota"}
          </Button>
          {estado === "guardada" && (
            <span className="flex items-center gap-1 text-[11px] text-green-400">
              <Check className="w-3 h-3" /> Guardada
            </span>
          )}
          {estado === "error" && (
            <span className="flex items-center gap-1 text-[11px] text-destructive">
              <AlertCircle className="w-3 h-3" /> No se pudo guardar
            </span>
          )}
        </div>
      </div>

      {/* Histórico */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {cargando ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-xs text-destructive text-center py-6">{error}</p>
        ) : notas.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Sin notas todavía. Apunta aquí lo que el equipo deba saber de este contacto.
          </p>
        ) : notas.map(n => (
          <div key={n.id} className="rounded-lg bg-secondary/40 border border-border/60 p-3">
            <p className="text-xs whitespace-pre-wrap leading-relaxed">{n.contenido}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
              {n.autor_nombre || "Agente"} · {moment(n.created_at).fromNow()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
