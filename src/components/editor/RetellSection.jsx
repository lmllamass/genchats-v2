import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/backendApi";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, Mic, CheckCircle2, Send, Clock, Phone } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";

export default function RetellSection({ proyecto }) {
  const { plan, user } = useSubscription();
  const isSuperPro = plan === "super-pro";
  const isActive = proyecto?.retell_activo === true;

  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  // STATE C: Retell already configured
  if (isActive) {
    return (
      <div className="px-4 py-4 space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Voz IA (Retell)</h4>
        <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-violet-400">Voz IA activa</span>
          </div>
          {proyecto.retell_phone_number && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span>{proyecto.retell_phone_number}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Tu chatbot puede recibir y realizar llamadas con voz IA mediante Retell.
          </p>
        </div>
      </div>
    );
  }

  // STATE A: Not Super Pro → send to pricing (la voz SÓLO con Super Pro)
  if (!isSuperPro) {
    return (
      <div className="px-4 py-4">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Voz IA (Retell)</h4>
        <div className="rounded-xl bg-secondary/30 border border-border p-4 text-center space-y-3">
          <Lock className="w-8 h-8 text-violet-400 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Disponible en el <span className="text-violet-400 font-semibold">Plan Super Pro</span> (99€/mes)
          </p>
          <Button asChild size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
            <Link to="/planes">Ver planes</Link>
          </Button>
        </div>
      </div>
    );
  }

  // STATE B: Super Pro, Retell not yet configured → request admin setup
  const handleRequest = async () => {
    setRequesting(true);
    try {
      await api.notifyRetellRequest({
        user_name: user?.full_name,
        user_email: user?.email,
        proyecto_nombre: proyecto?.nombre,
        proyecto_id: proyecto?.id,
      });
      setRequested(true);
      toast.success("Solicitud enviada. Te contactaremos en 24-48h.");
    } catch (err) {
      toast.error(err?.message || "Error al enviar la solicitud. Inténtalo de nuevo.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="px-4 py-4">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Voz IA (Retell)</h4>
      <div className="rounded-xl bg-secondary/30 border border-border p-4 space-y-3">
        {requested ? (
          <div className="text-center space-y-2 py-2">
            <Clock className="w-8 h-8 text-violet-400 mx-auto" />
            <p className="text-sm font-medium text-violet-400">Solicitud enviada</p>
            <p className="text-xs text-muted-foreground">
              Recibirás un email cuando tu agente de voz esté configurado y activo (habitualmente en 24-48h).
            </p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <Mic className="w-8 h-8 text-violet-400 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Con tu plan Super Pro puedes añadir un agente de voz IA (Retell) que recibe y realiza llamadas de forma autónoma. Solicítalo y nuestro equipo lo configurará para ti.
              </p>
            </div>
            <Button
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handleRequest}
              disabled={requesting}
            >
              {requesting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando solicitud...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Solicitar configuración de voz</>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
