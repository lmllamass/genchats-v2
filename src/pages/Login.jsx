/* global __BUILD_TIME__ */
import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextUrl = searchParams.get("next") || "/app";

  const dupGoogle = searchParams.get("dup_google") === "1";
  const dupEmail = searchParams.get("ge") || "";

  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${nextUrl}` },
    });
    if (err) { setError(err.message); setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    navigate(nextUrl);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success("Email enviado. Revisa tu bandeja de entrada.");
    setMode("login");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    // With autoconfirm enabled the session is returned immediately
    if (data?.session) {
      navigate(nextUrl);
      return;
    }
    toast.success("Cuenta creada. Revisa tu email para confirmar.");
    setLoading(false);
    setMode("login");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#0d1117" }}
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">GenChat IA</h1>
          <p className="text-[10px] font-mono text-white/20 mt-0.5">{(() => { try { const d = new Date(__BUILD_TIME__); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`; } catch { return '----'; } })()}</p>
          <p className="text-sm text-white/50">
            {mode === "login" ? "Accede a tu cuenta" : mode === "register" ? "Crea tu cuenta gratis" : "Recupera tu contraseña"}
          </p>
        </div>

        {/* Google duplicate warning */}
        {dupGoogle && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300 text-center leading-relaxed">
            Ya existe una cuenta con <strong className="text-amber-200">{dupEmail}</strong> registrada con email y contraseña.<br />
            Inicia sesión aquí abajo y luego vincula Google desde <strong className="text-amber-200">Mi Cuenta → Vincular Google</strong>.
          </div>
        )}

        {/* Form card */}
        <div
          className="rounded-2xl border p-6 space-y-4"
          style={{ background: "#161b22", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <form
            onSubmit={mode === "login" ? handleLogin : mode === "register" ? handleRegister : handleForgot}
            className="space-y-3"
          >
            {mode === "register" && (
              <div className="space-y-1">
                <label className="text-xs text-white/60 font-medium">Nombre</label>
                <Input
                  type="text"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-white/60 font-medium">Email</label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500"
              />
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/60 font-medium">Contraseña</label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(null); }}
                      className="text-xs text-violet-400 hover:text-violet-300"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder={mode === "register" ? "Mínimo 8 caracteres" : "Tu contraseña"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "register" ? 8 : undefined}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500"
                />
              </div>
            )}

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
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cargando...</>
              ) : mode === "login" ? (
                "Entrar"
              ) : mode === "register" ? (
                "Crear cuenta"
              ) : (
                "Enviar enlace de recuperación"
              )}
            </Button>
          </form>

          {/* Google OAuth */}
          {mode !== "forgot" && (
            <>
              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 border-t border-white/10" />
                <span className="text-xs text-white/30">o</span>
                <div className="flex-1 border-t border-white/10" />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={handleGoogleLogin}
                className="w-full border-white/10 text-white/70 hover:bg-white/5"
              >
                <svg className="w-4 h-4 mr-2 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </Button>
            </>
          )}

          {/* Toggle */}
          <p className="text-center text-xs text-white/40">
            {mode === "login" ? (
              <>
                ¿No tienes cuenta?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(null); }}
                  className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
                >
                  Regístrate
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(null); }}
                  className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
                >
                  Volver al inicio de sesión
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
