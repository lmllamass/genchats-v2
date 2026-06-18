import { Check, X, Crown, Zap, Mic } from "lucide-react";

const PLANS = [
  {
    id: "gratis",
    name: "Gratis",
    price: "0€",
    period: "/mes",
    desc: "Para probar sin compromiso",
    icon: Zap,
    features: [
      { t: "Web widget", ok: true },
      { t: "100 conversaciones/mes", ok: true },
      { t: "1 proyecto", ok: true },
      { t: "Snippet para tu web", ok: true },
      { t: "Soporte comunidad", ok: true },
      { t: "WhatsApp / Telegram", ok: false },
      { t: "CRM de leads", ok: false },
    ],
    cta: "Empezar gratis",
    type: "free",
  },
  {
    id: "pro",
    name: "Pro",
    price: "49€",
    period: "/mes",
    yearPrice: "490€/año — ahorra 2 meses",
    desc: "Para negocios que quieren vender más",
    icon: Crown,
    features: [
      { t: "Web + WhatsApp + Telegram", ok: true },
      { t: "Conversaciones ilimitadas", ok: true },
      { t: "3 proyectos", ok: true },
      { t: "CRM de leads incluido", ok: true },
      { t: "Detección ecommerce", ok: true },
      { t: "Soporte email prioritario", ok: true },
    ],
    cta: "Empezar 7 días gratis",
    popular: true,
    type: "checkout",
  },
  {
    id: "super-pro",
    name: "Super Pro",
    price: "99€",
    period: "/mes",
    desc: "Pro + chatbot con voz",
    icon: Mic,
    features: [
      { t: "Web + WhatsApp + Telegram", ok: true },
      { t: "Conversaciones ilimitadas", ok: true },
      { t: "3 proyectos", ok: true },
      { t: "CRM de leads incluido", ok: true },
      { t: "Detección ecommerce", ok: true },
      { t: "Chat voz 🎤 (STT + TTS)", ok: true },
      { t: "Soporte email prioritario", ok: true },
    ],
    cta: "Empezar 7 días gratis",
    type: "checkout",
  },
];

export default function PricingSection({ onCTA, onContact }) {
  return (
    <section id="precios" className="py-20" style={{ backgroundColor: "#0d1117" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.25em] text-orange-400 mb-3">Precios</p>
          <h2 className="font-display text-[clamp(28px,3.5vw,40px)] font-bold text-white tracking-tight leading-tight mb-3">
            Un plan para cada negocio
          </h2>
          <p className="text-slate-400 text-lg">Empieza gratis. Escala cuando lo necesites.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => {
            const isPro = plan.popular;
            return (
              <div
                key={plan.id}
                className="relative rounded-2xl p-7 flex flex-col transition-all"
                style={{
                  background: isPro ? "rgba(249,115,22,0.06)" : "#161b27",
                  border: isPro ? "2px solid #f97316" : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: isPro ? "0 0 40px rgba(249,115,22,0.15)" : "none",
                }}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-[11px] font-semibold uppercase tracking-wider" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
                    ⭐ Más popular
                  </div>
                )}

                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <plan.icon className="w-5 h-5" style={{ color: isPro ? "#f97316" : "#64748b" }} />
                    <h3 className="font-display text-xl font-bold text-white">{plan.name}</h3>
                  </div>
                  <p className="text-sm text-slate-400">{plan.desc}</p>
                </div>

                <div className="mb-1">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-slate-500 text-sm">{plan.period}</span>
                  </div>
                  {plan.yearPrice && (
                    <p className="text-xs text-orange-400/80 mt-1">{plan.yearPrice}</p>
                  )}
                </div>

                <ul className="space-y-3 my-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.t} className="flex items-center gap-2.5 text-sm">
                      {f.ok ? (
                        <Check className="w-4 h-4 shrink-0" style={{ color: isPro ? "#f97316" : "#22c55e" }} />
                      ) : (
                        <X className="w-4 h-4 text-slate-600 shrink-0" />
                      )}
                      <span className={f.ok ? "text-slate-300" : "text-slate-600"}>{f.t}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => plan.type === "contact" ? onContact() : onCTA()}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={
                    isPro
                      ? { background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", boxShadow: "0 0 20px rgba(249,115,22,0.3)" }
                      : { background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }
                  }
                >
                  {plan.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}