import { ArrowDown, Loader2 } from "lucide-react";
import moment from "moment";
import { useAutoScroll } from "@/hooks/useAutoScroll";

/**
 * Historial de mensajes con auto-scroll que no interrumpe la lectura.
 * La lógica de scroll vive en useAutoScroll — ver ahí el porqué de cada decisión.
 */
export default function MessageList({ messages, loading, convKey, className = "" }) {
  const { containerRef, onScroll, noLeidos, irAbajo } = useAutoScroll(messages.length, convKey);

  return (
    <div className={`relative flex-1 min-h-0 ${className}`}>
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto px-5 py-4 space-y-3"
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground">Sin mensajes</div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id ?? `idx-${i}`} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
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
      </div>

      {/* Aparece solo si llegan mensajes mientras el agente lee hacia arriba */}
      {noLeidos > 0 && (
        <button
          onClick={() => irAbajo("smooth")}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg hover:opacity-90 transition-opacity"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          {noLeidos} mensaje{noLeidos > 1 ? "s" : ""} nuevo{noLeidos > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
