import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { User, Crown, LogOut, HelpCircle, BookOpen, AlertTriangle, Send, Loader2, ArrowLeft, Phone, Mic, CheckCircle2, Clock, Lock, Check, Zap, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { api } from "@/api/backendApi";
import { toast } from "sonner";

const PLAN_LABELS = {
  free: { name: "Gratis", color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20" },
  gratis: { name: "Gratis", color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20" },
  pro: { name: "Pro", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  'super-pro': { name: "Super Pro", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
};

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
    price: "79€",
    period: "/mes + IVA",
    setup: "490€ de instalación y puesta en marcha (pago único)",
    desc: "Para negocios que quieren vender más",
    features: ["Web + WhatsApp + Telegram", "Conversaciones ilimitadas", "3 proyectos", "CRM de leads incluido", "Detección ecommerce", "Soporte email prioritario"],
    gradient: "from-orange-500 to-amber-500",
    popular: true,
  },
  {
    id: "super-pro",
    name: "Super Pro",
    price: "149€",
    period: "/mes + IVA",
    setup: "1.500€ de instalación y puesta en marcha (pago único)",
    desc: "Pro + chatbot con voz",
    features: ["Web + WhatsApp + Telegram", "Conversaciones ilimitadas", "3 proyectos", "CRM de leads incluido", "Detección ecommerce", "Chat voz 🎤 (STT + TTS)", "Soporte email prioritario"],
    gradient: "from-violet-500 to-purple-600",
  },
];

function WhatsAppStatusBadge({ proyecto, isPro }) {
  if (proyecto.whatsapp_activo) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
        <CheckCircle2 className="w-3 h-3" /> {proyecto.ycloud_phone_number || "Conectado"}
      </span>
    );
  }
  const isProActivated = ["pro_activo", "activo"].includes(proyecto.estado);
  if (isPro || isProActivated) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Clock className="w-3 h-3" /> Pendiente de configuración
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground border border-border">
      <Lock className="w-3 h-3" /> Requiere Plan Pro
    </span>
  );
}

function RetellStatusBadge({ proyecto, isSuperPro }) {
  if (proyecto.retell_activo) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
        <CheckCircle2 className="w-3 h-3" /> {proyecto.retell_phone_number || "Voz activa"}
      </span>
    );
  }
  if (isSuperPro) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Clock className="w-3 h-3" /> Pendiente de configuración
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground border border-border">
      <Lock className="w-3 h-3" /> Requiere Super Pro
    </span>
  );
}

export default function MiCuenta() {
  const { user, plan, isPaid, projectCount, limit, proyectos, loading } = useSubscription();
  const isSuperPro = plan === "super-pro";
  const { supabaseUser, logout, isLoadingAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "plan" ? "plan" : "cuenta");
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [loadingPortal, setLoadingPortal] = useState(false);

  if (searchParams.get("success") === "true") {
    toast.success("¡Suscripción activada! Bienvenido.");
    window.history.replaceState({}, "", "/mi-cuenta?tab=plan");
  }
  if (searchParams.get("canceled") === "true") {
    toast.info("Suscripción cancelada.");
    window.history.replaceState({}, "", "/mi-cuenta?tab=plan");
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

  const handleLinkGoogle = async () => {
    setLinkingGoogle(true);
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/mi-cuenta` },
    });
    if (error) {
      const msg = error.message?.toLowerCase().includes('manual linking')
        ? 'La vinculación manual no está activada. Inicia sesión directamente con Google en la pantalla de login.'
        : error.message;
      toast.error(msg);
      setLinkingGoogle(false);
    }
  };

  const hasGoogleLinked = supabaseUser?.identities?.some(i => i.provider === "google");
  const [issue, setIssue] = useState({ asunto: "", mensaje: "" });
  const [sending, setSending] = useState(false);

  if (isLoadingAuth || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?next=/mi-cuenta" replace />;
  }

  const planInfo = PLAN_LABELS[plan] || PLAN_LABELS.free;

  const handleSendIssue = async (e) => {
    e.preventDefault();
    if (!issue.asunto || !issue.mensaje) return toast.error("Completa todos los campos");
    setSending(true);
    await api.notifyLead({
      notification_email: "hola@konkabeza.es",
      nombre_negocio: `[GenChat Soporte] ${issue.asunto}`,
      lead: { notas: `Usuario: ${user.full_name} (${user.email})\nPlan: ${plan}\n\n${issue.mensaje}` },
    });
    toast.success("Problema enviado. Te contactaremos pronto.");
    setIssue({ asunto: "", mensaje: "" });
    setSending(false);
  };

  const TABS = [
    { id: "cuenta", label: "Mi cuenta", icon: User },
    { id: "plan", label: "Plan y facturación", icon: Crown },
    { id: "ayuda", label: "Ayuda y docs", icon: BookOpen },
    { id: "problema", label: "Reportar problema", icon: AlertTriangle },
  ];

  return (
    <div className="px-6 md:px-10 py-8 md:py-12 max-w-3xl mx-auto">
      <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Dashboard
      </Link>

      <h1 className="font-display text-3xl font-bold tracking-tight mb-8">Mi cuenta</h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Mi cuenta */}
      {tab === "cuenta" && (
        <div className="space-y-6">
          {/* Perfil y plan */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold">
                {user.full_name?.[0]?.toUpperCase() || "U"}
              </div>
              <div>
                <h2 className="font-display font-semibold text-lg">{user.full_name || "Usuario"}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-secondary/40 p-4">
                <p className="text-xs text-muted-foreground mb-1">Plan actual</p>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${planInfo.bg}`}>
                  <Crown className={`w-4 h-4 ${planInfo.color}`} />
                  <span className={`font-semibold text-sm ${planInfo.color}`}>{planInfo.name}</span>
                </div>
              </div>
              <div className="rounded-xl bg-secondary/40 p-4">
                <p className="text-xs text-muted-foreground mb-1">Proyectos</p>
                <p className="font-display font-bold text-2xl">{projectCount}<span className="text-sm text-muted-foreground font-normal">/{limit === 999999 ? "∞" : limit}</span></p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setTab("plan")}>
                <Crown className="w-4 h-4 mr-2" />{isPaid ? "Gestionar plan" : "Mejorar plan"}
              </Button>
              <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => logout("/")}>
                <LogOut className="w-4 h-4 mr-2" /> Salir
              </Button>
            </div>

            {/* Google linking */}
            <div className="rounded-xl bg-secondary/40 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Google</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {hasGoogleLinked ? "Cuenta Google vinculada — puedes iniciar sesión con Google" : "Vincula tu cuenta para poder iniciar sesión con Google"}
                </p>
              </div>
              {hasGoogleLinked ? (
                <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 shrink-0">Vinculado</span>
              ) : (
                <Button size="sm" variant="outline" onClick={handleLinkGoogle} disabled={linkingGoogle} className="shrink-0">
                  {linkingGoogle ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                    <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  )}
                  Vincular Google
                </Button>
              )}
            </div>
          </div>

          {/* Estado de integraciones por proyecto */}
          {proyectos.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" /> Integraciones activas
              </h3>
              <div className="space-y-3">
                {proyectos.map((p) => (
                  <div key={p.id} className="rounded-xl bg-secondary/30 p-3 space-y-2">
                    <p className="text-sm font-medium truncate">{p.nombre || "Proyecto sin nombre"}</p>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">WhatsApp:</span>
                        <WhatsAppStatusBadge proyecto={p} isPro={isPaid} />
                      </div>
                      {(isSuperPro || p.retell_activo) && (
                        <div className="flex items-center gap-1.5">
                          <Mic className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Voz:</span>
                          <RetellStatusBadge proyecto={p} isSuperPro={isSuperPro} />
                        </div>
                      )}
                      {p.telegram_username && (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <CheckCircle2 className="w-3 h-3" /> @{p.telegram_username}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {!isPaid && (
                <p className="text-xs text-muted-foreground">
                  Activa WhatsApp Business con el{" "}
                  <button onClick={() => setTab("plan")} className="text-amber-400 hover:underline font-medium">Plan Pro →</button>
                </p>
              )}
              {isPaid && !isSuperPro && (
                <p className="text-xs text-muted-foreground">
                  Añade voz IA con el{" "}
                  <button onClick={() => setTab("plan")} className="text-violet-400 hover:underline font-medium">Plan Super Pro →</button>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Plan y facturación */}
      {tab === "plan" && (
        <div className="space-y-8">
          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map(p => {
              const isCurrent = plan === p.id;
              return (
                <div key={p.id} className={`relative rounded-2xl border p-6 transition-all flex flex-col ${p.popular ? "border-primary/50 bg-card" : "border-border bg-card/80"}`}>
                  {p.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[10px] font-semibold uppercase tracking-wider">
                      Popular
                    </div>
                  )}
                  <div className="mb-4">
                    <h3 className="font-display text-lg font-bold">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-display text-3xl font-bold">{p.price}</span>
                    <span className="text-muted-foreground text-xs">{p.period}</span>
                  </div>
                  {p.setup ? (
                    <p className="text-[11px] text-amber-400/90 mb-5 leading-snug">+ {p.setup}</p>
                  ) : (
                    <div className="mb-5" />
                  )}
                  <ul className="space-y-2 mb-6 flex-1">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs">
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button disabled variant="outline" className="w-full" size="sm">
                      <Check className="w-4 h-4 mr-2" /> Tu plan actual
                    </Button>
                  ) : (
                    <Button
                      size="sm"
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

          {isPaid && user?.stripe_customer_id && (
            <div className="text-center">
              <Button variant="outline" onClick={handlePortal} disabled={loadingPortal} className="gap-2">
                {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                Gestionar suscripción
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Cambiar plan, actualizar pago o cancelar</p>
            </div>
          )}
        </div>
      )}

      {/* Ayuda y docs */}
      {tab === "ayuda" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2"><HelpCircle className="w-5 h-5 text-primary" /> Centro de ayuda</h3>
            <div className="space-y-3">
              {[
                { q: "¿Cómo creo un chatbot?", a: "Ve a 'Nuevo Chatbot', pega la URL de tu web y sigue los 3 pasos. En menos de 2 minutos tendrás tu chatbot listo." },
                { q: "¿Cómo instalo el chatbot en mi web?", a: "Desde el Editor de tu proyecto, haz clic en 'Exportar'. Copia el código del snippet y pégalo antes del cierre </body> de tu web." },
                { q: "¿Cómo conecto WhatsApp o Telegram?", a: "Necesitas el plan Pro o superior. Desde el Editor, en la pestaña Chatbot verás la sección de canales. Pulsa 'Solicitar conexión WhatsApp' y nuestro equipo lo configurará en 24-48h." },
                { q: "¿Cómo funciona el CRM de leads?", a: "El chatbot captura automáticamente los datos de contacto que los visitantes comparten. Los puedes ver en la pestaña 'Leads' del Editor." },
                { q: "¿Puedo conectar mi tienda online?", a: "Sí. Desde la pestaña E-commerce del Editor puedes conectar WooCommerce, Shopify, PrestaShop y más." },
              ].map((item, i) => (
                <details key={i} className="group rounded-xl bg-secondary/30 p-4">
                  <summary className="cursor-pointer text-sm font-medium flex items-center justify-between">
                    {item.q}
                    <span className="text-muted-foreground group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display font-semibold mb-2">¿Necesitas más ayuda?</h3>
            <p className="text-sm text-muted-foreground mb-4">Contacta con nuestro equipo por WhatsApp o email.</p>
            <div className="flex gap-3">
              <a href="https://wa.me/34919932159" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">💬 WhatsApp</Button>
              </a>
              <a href="mailto:hola@konkabeza.es">
                <Button variant="outline" size="sm">✉️ Email</Button>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Reportar problema */}
      {tab === "problema" && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-display font-semibold text-lg mb-1 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-400" /> Reportar un problema</h3>
          <p className="text-sm text-muted-foreground mb-6">Describe el problema y te responderemos lo antes posible.</p>
          <form onSubmit={handleSendIssue} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Asunto</label>
              <input
                value={issue.asunto}
                onChange={(e) => setIssue({ ...issue, asunto: e.target.value })}
                placeholder="Ej: El chatbot no responde correctamente"
                className="w-full px-4 py-2.5 rounded-xl text-sm bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Descripción</label>
              <textarea
                value={issue.mensaje}
                onChange={(e) => setIssue({ ...issue, mensaje: e.target.value })}
                placeholder="Explica con detalle qué ocurre, en qué proyecto y qué pasos has seguido..."
                rows={5}
                className="w-full px-4 py-2.5 rounded-xl text-sm bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <Button type="submit" disabled={sending} className="w-full">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar reporte
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
