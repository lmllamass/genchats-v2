import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/backendApi";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, Phone, CheckCircle2, Send, Clock } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import WhatsAppModeSelector from "./WhatsAppModeSelector";
import WhatsAppConversations from "./WhatsAppConversations";
import WhatsAppTemplates from "./WhatsAppTemplates";

export default function WhatsAppSection({ proyecto }) {
  const { plan, user } = useSubscription();
  const queryClient = useQueryClient();
  const isPro = plan === "pro" || plan === "super-pro";
  const isActive = proyecto?.whatsapp_activo === true;
  // Admin-activated projects count as pro even if user's own plan is free
  const projectIsProActivated = ["pro_activo", "activo"].includes(proyecto?.estado);

  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  // STATE C: WhatsApp already active — show this FIRST regardless of user plan
  if (isActive) {
    const mensajesMes = proyecto.mensajes_mes || 0;
    const limite = proyecto.limite_mensajes || 200;
    const pct = Math.min((mensajesMes / limite) * 100, 100);

    return (
      <div className="px-4 py-4 space-y-4">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">WhatsApp</h4>
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">Conectado</span>
            <Badge variant="outline" className="text-xs border-green-500/30 text-green-300 ml-auto">
              {proyecto.ycloud_phone_number}
            </Badge>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mensajes este mes</span>
              <span>{mensajesMes} / {limite}</span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        </div>
        <WhatsAppModeSelector proyecto={proyecto} />
        <WhatsAppTemplates proyectoId={proyecto.id} />
        <WhatsAppConversations proyectoId={proyecto.id} />
      </div>
    );
  }

  // STATE A: No Pro plan (and not admin-activated) → send to pricing page
  if (!isPro && !projectIsProActivated) {
    return (
      <div className="px-4 py-4">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">WhatsApp</h4>
        <div className="rounded-xl bg-secondary/30 border border-border p-4 text-center space-y-3">
          <Lock className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Disponible en el <span className="text-amber-400 font-semibold">Plan Pro</span> (49€/mes)
          </p>
          <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
            <Link to="/planes">Ver planes</Link>
          </Button>
        </div>
      </div>
    );
  }

  // STATE B: Pro active, WhatsApp not yet configured → request admin setup
  const handleRequest = async () => {
    setRequesting(true);
    try {
      await api.notifyWhatsAppRequest({
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
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">WhatsApp</h4>
      <div className="rounded-xl bg-secondary/30 border border-border p-4 space-y-3">
        {requested ? (
          <div className="text-center space-y-2 py-2">
            <Clock className="w-8 h-8 text-blue-400 mx-auto" />
            <p className="text-sm font-medium text-blue-400">Solicitud enviada</p>
            <p className="text-xs text-muted-foreground">
              Recibirás un email cuando tu número esté configurado y activo (habitualmente en 24-48h).
            </p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <Phone className="w-8 h-8 text-green-400 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Con tu plan Pro puedes conectar WhatsApp Business. Solicítalo y nuestro equipo lo configurará para ti.
              </p>
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={handleRequest}
              disabled={requesting}
            >
              {requesting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando solicitud...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Solicitar conexión WhatsApp</>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
