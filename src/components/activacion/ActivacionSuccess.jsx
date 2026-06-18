import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export default function ActivacionSuccess({ proyecto, userEmail }) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate(`/editor/${proyecto.id}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate, proyecto.id]);

  return (
    <div className="min-h-screen bg-background bg-grid flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-lg space-y-6"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mx-auto">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <h1 className="font-display text-3xl font-bold">¡Perfecto!</h1>
        <p className="text-muted-foreground leading-relaxed">
          En los próximos minutos recibirás un email en <strong className="text-foreground">{userEmail}</strong> con los accesos a tus canales.
          Nuestro equipo está configurando tu chatbot ahora mismo.
        </p>
        <p className="text-sm text-muted-foreground/60">
          Redirigiendo al editor en {countdown}s...
        </p>
      </motion.div>
    </div>
  );
}