import { Link } from "react-router-dom";
import { Crown, Lock, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UpgradeWall({ reason = "limit" }) {
  const messages = {
    limit: { title: "Límite alcanzado", desc: "Has usado tu página gratuita. Actualiza a Pro para crear proyectos ilimitados." },
    expired: { title: "Periodo de prueba expirado", desc: "Tu trial de 7 días ha terminado. Actualiza para continuar usando GenChats IA." },
  };
  const msg = messages[reason] || messages.limit;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur p-12 md:p-20 text-center max-w-2xl mx-auto">
      <div className="absolute inset-0 bg-radial-purple pointer-events-none" />
      <div className="relative">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{msg.title}</h2>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto">{msg.desc}</p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="bg-gradient-to-r from-violet-500 to-blue-500 hover:opacity-90 glow-purple">
            <Link to="/planes"><Crown className="w-4 h-4 mr-2" /> Ver planes y precios</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Volver al dashboard</Link>
          </Button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 text-left max-w-sm mx-auto">
          {["Proyectos ilimitados", "Todas las plantillas", "Exportación ZIP"].map(f => (
            <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-3 h-3 text-primary shrink-0" />{f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}