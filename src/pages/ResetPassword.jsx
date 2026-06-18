import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  // Capture flow type from hash on mount (before Supabase clears it).
  // Invite links contain type=invite; recovery links contain type=recovery.
  const [isInvite] = useState(() => window.location.hash.includes("type=invite"));

  useEffect(() => {
    // For invite flow Supabase fires SIGNED_IN (not PASSWORD_RECOVERY).
    // For recovery flow it fires PASSWORD_RECOVERY.
    // Also check if a session already exists (race: event may fire before listener).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "USER_UPDATED") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success(
      isInvite ? "✅ ¡Cuenta activada! Bienvenido/a." : "Contraseña actualizada correctamente."
    );
    navigate("/app");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0d1117" }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isInvite ? "Activa tu cuenta" : "Nueva contraseña"}
          </h1>
          <p className="text-sm text-white/50">
            {isInvite
              ? "Elige una contraseña para completar tu registro"
              : "Elige una contraseña segura para tu cuenta"}
          </p>
        </div>

        <div
          className="rounded-2xl border p-6 space-y-4"
          style={{ background: "#161b22", borderColor: "rgba(255,255,255,0.08)" }}
        >
          {!ready ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
              <p className="text-sm text-white/50">
                {isInvite ? "Verificando invitación…" : "Verificando enlace…"}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-white/60 font-medium">
                  {isInvite ? "Contraseña" : "Nueva contraseña"}
                </label>
                <Input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/60 font-medium">Confirmar contraseña</label>
                <Input
                  type="password"
                  placeholder="Repite la contraseña"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando…</>
                ) : isInvite ? (
                  "Activar cuenta"
                ) : (
                  "Guardar nueva contraseña"
                )}
              </Button>
            </form>
          )}
        </div>

        {isInvite && (
          <p className="text-center text-xs text-white/30">
            GenChats IA · Tu cuenta ya está creada, solo define tu contraseña.
          </p>
        )}
      </div>
    </div>
  );
}
