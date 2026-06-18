import { Crown, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";

export default function ProBanner() {
  const navigate = useNavigate();
  const { plan } = useSubscription();

  // Hide for paid users
  if (plan === "pro" || plan === "super-pro") return null;

  return (
    <div className="mx-4 my-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
          <Crown className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-300">Activa WhatsApp y Telegram por 49€/mes</p>
          <p className="text-xs text-amber-400/70 mt-0.5">Conecta tu chatbot a los canales más populares</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          onClick={() => navigate("/planes")}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-white w-full"
        >
          <Crown className="w-3.5 h-3.5 mr-1.5" />
          Mejorar a Pro
        </Button>
        <a
          href="https://konkabeza.es/reservarcita"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 transition-colors w-full"
        >
          <Wrench className="w-3.5 h-3.5 shrink-0" />
          Quiero que me lo instalen — 69€
        </a>
      </div>
    </div>
  );
}