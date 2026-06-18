import { useQuery } from "@tanstack/react-query";
import { MensajeWA } from "@/api/entidades";
import { Loader2, MessageSquare, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import moment from "moment";

const estadoBadge = {
  recibido: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  enviado: "bg-green-500/20 text-green-300 border-green-500/30",
  entregado: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  leido: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  error: "bg-red-500/20 text-red-300 border-red-500/30",
};

export default function WhatsAppMessageHistory({ proyectoId }) {
  const { data: mensajes = [], isLoading } = useQuery({
    queryKey: ["wa-messages", proyectoId],
    queryFn: () => MensajeWA.list(proyectoId, 30),
    enabled: !!proyectoId,
    refetchInterval: 15000,
  });

  return (
    <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-green-400" />
        <h3 className="text-sm font-semibold text-white">Historial de mensajes WhatsApp</h3>
        <span className="text-[10px] text-white/40 ml-auto">Últimos 30 · auto-refresh 15s</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-white/30" />
        </div>
      ) : mensajes.length === 0 ? (
        <div className="text-center py-10 text-white/30 text-sm">Sin mensajes todavía</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/40 border-b border-white/10">
                <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                <th className="text-left px-4 py-2.5 font-medium">De → Para</th>
                <th className="text-left px-4 py-2.5 font-medium">Mensaje cliente</th>
                <th className="text-left px-4 py-2.5 font-medium">Respuesta IA</th>
                <th className="text-left px-4 py-2.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {mensajes.map((m) => (
                <tr key={m.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-2.5 text-white/50 whitespace-nowrap">
                    {moment(m.created_at).format("DD/MM HH:mm")}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-white/60">
                      <ArrowDownLeft className="w-3 h-3 text-blue-400" />
                      <span className="font-mono text-[11px]">{m.from_number || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-white/40 mt-0.5">
                      <ArrowUpRight className="w-3 h-3 text-green-400" />
                      <span className="font-mono text-[11px]">{m.to_number || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 max-w-[220px]">
                    <p className="text-white/70 truncate">{m.mensaje || "—"}</p>
                  </td>
                  <td className="px-4 py-2.5 max-w-[280px]">
                    <p className="text-white/70 truncate">{m.respuesta || <span className="text-white/30 italic">sin respuesta</span>}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${estadoBadge[m.estado] || "bg-white/10 text-white/50 border-white/10"}`}>
                      {m.estado || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
