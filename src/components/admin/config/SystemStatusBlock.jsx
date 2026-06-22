import { useQuery } from "@tanstack/react-query";
import { Proyecto, MensajeWA } from "@/api/entidades";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API_PUBLIC_URL = import.meta.env.VITE_API_URL || "https://api-v2.genchats.app";
const WEBHOOK_URL = `${API_PUBLIC_URL}/api/ycloud/webhook`;

export default function SystemStatusBlock({ config }) {
  const { data: proyectos = [] } = useQuery({
    queryKey: ["admin-proyectos-status"],
    queryFn: () => Proyecto.listAll(),
    initialData: [],
  });

  const { data: lastMsg = null } = useQuery({
    queryKey: ["admin-mensajes-status"],
    queryFn: () => MensajeWA.lastOne(),
    initialData: null,
  });

  const activos = proyectos.filter(p => p.estado === "pro_activo" || p.estado === "activo").length;
  const msgMes = proyectos.reduce((sum, p) => sum + (p.mensajes_mes || 0), 0);
  const lastMsgAgo = lastMsg ? Math.round((Date.now() - new Date(lastMsg.created_at).getTime()) / 60000) : null;

  const ycloud = !!config?.ycloud_api_key;
  const openai = !!config?.openai_api_key;
  const stripe = !!config?.stripe_secret_key;
  const meta = config?.meta_modo === "activo";

  const Dot = ({ ok, pending }) => (
    <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1 ${pending ? "bg-yellow-400" : ok ? "bg-green-400" : "bg-red-400"}`} />
  );

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
          <span className="text-lg">📊</span>
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">Estado del sistema</h3>
          <p className="text-[11px] text-white/40">Vista general y semáforo</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-1"><Dot ok={ycloud} /> <span className="text-white/70">YCloud {ycloud ? "✅" : "❌"}</span></div>
        <div className="flex items-center gap-1"><Dot ok={openai} /> <span className="text-white/70">OpenAI {openai ? "✅" : "❌"}</span></div>
        <div className="flex items-center gap-1"><Dot ok={stripe} /> <span className="text-white/70">Stripe {stripe ? "✅" : "❌"}</span></div>
        <div className="flex items-center gap-1"><Dot ok={meta} pending={!meta} /> <span className="text-white/70">Meta {meta ? "✅" : "⏳"}</span></div>
      </div>

      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
        <p className="text-xs text-orange-400/60 mb-1">Webhook URL — pégalo en YCloud:</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm text-orange-300 font-mono break-all select-all">{WEBHOOK_URL}</code>
          <Button type="button" size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success("📋 Copiado"); }}
            className="text-orange-400 hover:text-orange-300 border border-orange-500/30 shrink-0">
            <Copy className="w-3 h-3 mr-1" /> Copiar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{activos}</div>
          <div className="text-[10px] text-white/40">Proyectos activos</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{msgMes}</div>
          <div className="text-[10px] text-white/40">Mensajes este mes</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{lastMsgAgo !== null ? `${lastMsgAgo}m` : "—"}</div>
          <div className="text-[10px] text-white/40">Último mensaje</div>
        </div>
      </div>
    </div>
  );
}
