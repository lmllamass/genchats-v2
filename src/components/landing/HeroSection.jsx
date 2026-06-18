import { ArrowRight, Play } from "lucide-react";

export default function HeroSection({ onCTA, onDemo }) {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden" style={{ background: "linear-gradient(135deg, #0d1117 0%, #1a1040 50%, #0d1117 100%)" }}>
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(249,115,22,0.25) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full filter blur-[80px]" style={{ background: "radial-gradient(circle, rgba(249,115,22,0.15), rgba(139,92,246,0.08), transparent)" }} />

      <div className="relative max-w-3xl mx-auto text-center px-6 py-24">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300 text-xs font-medium mb-8">
          🤖 Chatbot IA para tu negocio — gratis para siempre
        </div>

        <h1 className="font-display text-[clamp(36px,5.5vw,64px)] font-extrabold tracking-tight leading-[1.05] text-white mb-6">
          Tu negocio responde solo.{" "}
          <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">24/7.</span>
        </h1>

        <p className="text-lg text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed">
          Crea un chatbot con el conocimiento de tu web en 2 minutos. Sin código. Sin configuración.
        </p>

        <div className="flex flex-wrap gap-4 justify-center mb-6">
          <button
            onClick={onCTA}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", boxShadow: "0 0 30px rgba(249,115,22,0.4)" }}
          >
            Empieza gratis <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onDemo}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-medium text-base border border-white/10 hover:bg-white/5 transition-all"
          >
            <Play className="w-4 h-4" /> Ver demo
          </button>
        </div>

        <p className="text-xs text-slate-500">Sin tarjeta de crédito · Cancela cuando quieras</p>
      </div>
    </section>
  );
}