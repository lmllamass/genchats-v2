import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Clock, Crown, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

export default function TrialBanner() {
  const { user, isAdmin, isPaid, trialDaysLeft, trialExpired, loading } = useSubscription();
  const { updateMe } = useAuth();

  // Auto-set trial_ends_at on first visit if not set
  useEffect(() => {
    if (user && !isAdmin && !user.trial_ends_at) {
      const ends = new Date();
      ends.setDate(ends.getDate() + 7);
      updateMe({ trial_ends_at: ends.toISOString() });
    }
  }, [user, isAdmin]);

  if (loading || isAdmin || isPaid) return null;

  if (trialExpired) {
    return (
      <div className="mx-4 mt-3 rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">Tu periodo de prueba ha expirado</p>
          <p className="text-xs text-destructive/80">Actualiza a Pro para seguir creando proyectos.</p>
        </div>
        <Link to="/planes" className="shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs font-medium hover:opacity-90">
          <Crown className="w-3 h-3 inline mr-1" /> Upgrade
        </Link>
      </div>
    );
  }

  if (trialDaysLeft <= 3) {
    return (
      <div className="mx-4 mt-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 flex items-center gap-3">
        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="text-xs text-amber-300 flex-1">
          Te quedan <strong>{trialDaysLeft} día{trialDaysLeft !== 1 ? "s" : ""}</strong> de prueba gratuita.
        </p>
        <Link to="/planes" className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/30">
          Ver planes
        </Link>
      </div>
    );
  }

  return null;
}
