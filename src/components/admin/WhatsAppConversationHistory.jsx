import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Loader2, MessageSquare, Phone } from "lucide-react";
import MessageList from "@/components/inbox/MessageList";

/**
 * Vista de solo lectura del historial de WhatsApp de un proyecto, para admin.
 *
 * Sustituye a la antigua tabla técnica (WhatsAppMessageHistory, con estados de entrega
 * enviado/entregado/leído) por algo con la misma cara que el inbox real: burbujas de
 * conversación, no filas de log. No es el inbox de verdad (eso requiere ser el dueño del
 * proyecto), pero es la única forma que tiene admin de ver la conversación de un proyecto
 * que no es suyo — se agrupa por visitor_id para no mezclar clientes distintos en un mismo
 * hilo de burbujas.
 */
export default function WhatsAppConversationHistory({ proyectoId }) {
  const { data: mensajes = [], isLoading } = useQuery({
    queryKey: ["wa-conversaciones-chat", proyectoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversaciones_chat")
        .select("id, visitor_id, role, content, created_at")
        .eq("proyecto_id", proyectoId)
        .eq("canal", "whatsapp")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data || []).reverse();
    },
    enabled: !!proyectoId,
    refetchInterval: 15000,
  });

  const hilos = mensajes.reduce((acc, m) => {
    (acc[m.visitor_id] ||= []).push(m);
    return acc;
  }, {});
  const numeros = Object.keys(hilos);

  return (
    <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-green-400" />
        <h3 className="text-sm font-semibold text-white">Conversaciones de WhatsApp</h3>
        <span className="text-[10px] text-white/40 ml-auto">Últimos 60 mensajes · auto-refresh 15s</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-white/30" />
        </div>
      ) : numeros.length === 0 ? (
        <div className="text-center py-10 text-white/30 text-sm">Sin mensajes todavía</div>
      ) : (
        <div className="divide-y divide-white/5">
          {numeros.map((numero) => (
            <div key={numero}>
              <div className="px-5 py-2 flex items-center gap-1.5 text-xs text-white/50 bg-white/[0.015]">
                <Phone className="w-3 h-3" />
                <span className="font-mono">{numero}</span>
              </div>
              <div className="max-h-[360px]">
                <MessageList messages={hilos[numero]} loading={false} convKey={`${proyectoId}~whatsapp~${numero}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
