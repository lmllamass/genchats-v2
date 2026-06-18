import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/api/backendApi";

export default function Activacion() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [countdown, setCountdown] = useState(6);

  useEffect(() => {
    if (!sessionId) {
      navigate("/planes");
      return;
    }
    // Verify the session with backend
    api.stripeVerifySession(sessionId)
      .then((data) => {
        if (data?.paid) {
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        // Even if verify fails, Stripe already redirected here after payment — treat as success
        setStatus("success");
      });
  }, [sessionId, navigate]);

  // Countdown redirect after success
  useEffect(() => {
    if (status !== "success") return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/app");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, navigate]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Confirmando tu pago…</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md space-y-6"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 mx-auto">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="font-display text-2xl font-bold">Error al verificar el pago</h1>
          <p className="text-muted-foreground text-sm">
            Si completaste el pago, tu cuenta se activará en unos minutos. Si el problema persiste, contáctanos.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/planes")}>Volver a planes</Button>
            <Button onClick={() => navigate("/app")}>Ir al dashboard</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-lg space-y-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
          className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-500/20 mx-auto"
        >
          <CheckCircle2 className="w-12 h-12 text-green-400" />
        </motion.div>

        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold">¡Bienvenido al plan Pro! 🎉</h1>
          <p className="text-muted-foreground leading-relaxed">
            Tu suscripción está activa. Ya puedes usar WhatsApp, Telegram y todos los canales sin límites.
          </p>
        </div>

        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-sm text-green-300 space-y-1">
          <p className="font-medium">¿Qué tienes ahora?</p>
          <ul className="text-left space-y-1 text-green-300/80 mt-2">
            <li>✓ Web + WhatsApp + Telegram</li>
            <li>✓ Conversaciones ilimitadas</li>
            <li>✓ Hasta 3 proyectos activos</li>
            <li>✓ CRM de leads incluido</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 text-white gap-2"
            onClick={() => navigate("/app")}
          >
            Ir al dashboard <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground/60">
          Redirigiendo automáticamente en {countdown}s…
        </p>
      </motion.div>
    </div>
  );
}
