import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Crown, Zap, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api/backendApi";
import { toast } from "sonner";

const PLANS = [
  {
    id: "gratis",
    name: "Gratis",
    price: "0€",
    period: "/mes",
    desc: "Para probar sin compromiso",
    features: ["Web widget", "100 conversaciones/mes", "1 proyecto", "Snippet para tu web", "Soporte comunidad"],
    gradient: "from-slate-500 to-slate-600",
  },
  {
    id: "pro",
    name: "Pro",
    price: "49€",
    period: "/mes",
    desc: "Para negocios que quieren vender más",
    features: ["Web + WhatsApp + Telegram", "Conversaciones ilimitadas", "3 proyectos", "CRM de leads incluido", "Detección ecommerce", "Soporte email prioritario"],
    gradient: "from-orange-500 to-amber-500",
    popular: true,
  },
  {
    id: "super-pro",
    name: "Super Pro",
    price: "99€",
    period: "/mes",
    desc: "Pro + chatbot con voz",
    features: ["Web + WhatsApp + Telegram", "Conversaciones ilimitadas", "3 proyectos", "CRM de leads incluido", "Detección ecommerce", "Chat voz 🎤 (STT + TTS)", "Soporte email prioritario"],
    gradient: "from-violet-500 to-purple-600",
  },
];

export default function Planes() {
  const { plan, isAdmin, isPaid, trialDaysLeft, trialExpired } = useSubscription();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [searchParams] = useSearchParams();

  // Show toast on redirect from Stripe
  if (searchParams.get("success") === "true") {
    toast.success("¡Suscripción activada! Bienvenido.");
    window.history.replaceState({}, "", "/planes");
  }
  if (searchParams.get("canceled") === "true") {
    toast.info("Suscripción cancelada.");
    window.history.replaceState({}, "", "/planes");
  }

  const handleCheckout = async (planId) => {
    setLoadingPlan(planId);
    try {
      const tipo = planId === "pro" ? "pro" : planId === "super-pro" ? "super-pro" : planId;
      const res = await api.stripeCheckout({ tipo, user_email: user.email, user_id: user.id });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        toast.error(res?.error || "Error al crear la sesión de pago");
        setLoadingPlan(null);
      }
    } catch (err) {
      toast.error(err.message || "Error al conectar con el servidor de pagos");
      setLoadingPlan(null);
    }
  };

  const handlePortal = async () => {
    setLoadingPortal(true);
    const res = await api.stripePortal({ user_email: user.email });
    if (res?.url) {
      window.location.href = res.url;
    } else {
      toast.error(res?.error || "Error al abrir el portal");
      setLoadingPortal(false);
    }
  };

  return (
    <div className="px-6 md:px-10 py-8 md:py-12 max-w-6xl mx-auto">
      <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Dashboard
      </Link>

      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
          <Crown className="w-3 h-3" /> Planes y precios
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Elige tu <span className="gradient-text">plan</span>
        </h1>
        <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
          Empieza con 7 días de prueba gratuita. Elige el plan que mejor se adapte a ti.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {PLANS.map(p => {
          const isCurrent = plan === p.id;
          return (
            <div key={p.id} className={`relative rounded-2xl border p-7 transition-all flex flex-col ${p.popular ? "border-primary/50 bg-card" : "border-border bg-card/80"}`}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[10px] font-semibold uppercase tracking-wider">
                  Popular
                </div>
              )}
              <div className="mb-5">
                <h3 className="font-display text-xl font-bold">{p.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="font-display text-4xl font-bold">{p.price}</span>
                <span className="text-muted-foreground text-sm">{p.period}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />{f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <Button disabled variant="outline" className="w-full">
                  <Check className="w-4 h-4 mr-2" /> Tu plan actual
                </Button>
              ) : (
                <Button
                  className={`w-full bg-gradient-to-r ${p.gradient} hover:opacity-90 text-white`}
                  onClick={() => handleCheckout(p.id)}
                  disabled={loadingPlan === p.id}
                >
                  {loadingPlan === p.id ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirigiendo…</>
                  ) : (
                    <><Zap className="w-4 h-4 mr-2" /> Suscribirse</>
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Portal de gestión */}
      {isPaid && user?.stripe_customer_id && (
        <div className="text-center mt-10">
          <Button variant="outline" onClick={handlePortal} disabled={loadingPortal} className="gap-2">
            {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
            Gestionar suscripción
          </Button>
          <p className="text-xs text-muted-foreground mt-2">Cambiar plan, actualizar pago o cancelar</p>
        </div>
      )}

      {/* Trial info */}
      {!isPaid && !isAdmin && (
        <div className="text-center mt-8 text-sm text-muted-foreground">
          {trialExpired
            ? "Tu periodo de prueba ha expirado. Elige un plan para continuar."
            : `Te quedan ${trialDaysLeft} días de prueba gratuita.`}
        </div>
      )}
    </div>
  );
}
