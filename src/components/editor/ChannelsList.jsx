import { Globe, Lock, MessageCircle, Mic, Loader2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { api } from "@/api/backendApi";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

const CHANNELS = [
  { id: "web", name: "Web", icon: Globe, free: true },
  { id: "whatsapp", name: "WhatsApp", icon: MessageCircle, minPlan: "pro" },
  { id: "telegram", name: "Telegram", icon: MessageCircle, minPlan: "pro" },
  { id: "voz", name: "Voz IA (Retell)", icon: Mic, minPlan: "super-pro" },
];

const PLAN_LEVEL = { free: 0, gratis: 0, pro: 1, 'super-pro': 2 };

export default function ChannelsList({ proyecto }) {
  const navigate = useNavigate();
  const { plan } = useSubscription();
  const userLevel = PLAN_LEVEL[plan] ?? 0;
  const [requesting, setRequesting] = useState(false);

  const agentName = proyecto?.agent_name;
  const isPending = agentName === "pending";

  // If admin activated this project as pro/activo, treat it as pro regardless of user's own plan
  const projectIsProActivated = ["pro_activo", "activo"].includes(proyecto?.estado);
  const effectiveLevel = projectIsProActivated ? Math.max(userLevel, 1) : userLevel;

  const getChannelActive = (ch) => {
    if (ch.id === "whatsapp") return proyecto?.whatsapp_activo === true;
    if (ch.id === "telegram") return proyecto?.telegram_activo === true;
    if (ch.id === "voz") return proyecto?.retell_activo === true;
    return false;
  };

  const handleRequestActivation = async () => {
    if (!proyecto?.id) return;
    setRequesting(true);
    try {
      await api.generarChatbot(proyecto.id);
      toast.success("Solicitud enviada. Activaremos tus canales en breve.");
    } catch (e) {
      toast.error("Error: " + e.message);
    } finally {
      setRequesting(false);
    }
  };

  // WhatsApp and Telegram connect URLs are not implemented — show manual config
  const getChannelLink = () => null;

  return (
    <div className="px-4 py-3">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Canales</h4>
      <div className="space-y-2">
        {CHANNELS.map(ch => {
          const requiredLevel = ch.free ? 0 : (PLAN_LEVEL[ch.minPlan] ?? 1);
          const isAvailable = effectiveLevel >= requiredLevel || getChannelActive(ch);

          return (
            <div key={ch.id} className="space-y-1">
              <button
                onClick={!isAvailable ? () => navigate("/planes") : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isAvailable
                    ? "bg-secondary/50 text-foreground"
                    : "bg-secondary/20 text-muted-foreground hover:bg-secondary/30 cursor-pointer"
                }`}
              >
                <ch.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{ch.name}</span>
                {!isAvailable ? (
                  <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${ch.minPlan === 'super-pro' ? 'bg-violet-500/10 text-violet-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    <Lock className="w-3 h-3" /> {ch.minPlan === 'super-pro' ? 'Super Pro' : 'Plan Pro'}
                  </span>
                ) : ch.free ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">Activo</span>
                ) : isPending ? (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                    <Clock className="w-3 h-3" /> Activando...
                  </span>
                ) : getChannelActive(ch) ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">Activo</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">No activado</span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Show activation button for Pro users without agent (not shown if admin already activated) */}
      {effectiveLevel >= 1 && !agentName && proyecto?.chatbot_config && !projectIsProActivated && (
        <Button
          size="sm"
          className="w-full mt-3"
          onClick={handleRequestActivation}
          disabled={requesting}
        >
          {requesting ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Solicitando...</>
          ) : (
            "Activar WhatsApp y Telegram"
          )}
        </Button>
      )}

      {/* Pending activation message */}
      {isPending && (
        <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-xs text-blue-300">
            ⏳ Tus canales están siendo configurados. Recibirás un aviso cuando estén listos.
          </p>
        </div>
      )}
    </div>
  );
}
