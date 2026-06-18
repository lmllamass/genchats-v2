import { Search, Palette, Code2 } from "lucide-react";

const STEPS = [
  { icon: Search, num: "01", title: "Pega tu URL", desc: "Analizamos tu web automáticamente y extraemos todo el contenido relevante para entrenar a tu chatbot." },
  { icon: Palette, num: "02", title: "Elige tu estilo", desc: "Personaliza colores, nombre y tono del asistente para que encaje con la imagen de tu marca." },
  { icon: Code2, num: "03", title: "Copia el snippet", desc: "Pega una línea de código en tu web y tu chatbot estará funcionando al instante." },
];

export default function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-20 border-t border-white/5" style={{ backgroundColor: "#0d1117" }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.25em] text-orange-400 mb-3">Cómo funciona</p>
          <h2 className="font-display text-[clamp(28px,3.5vw,40px)] font-bold text-white tracking-tight leading-tight">
            Tres pasos. Dos minutos.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div key={s.num} className="relative rounded-2xl p-7 overflow-hidden" style={{ background: "#161b27", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="absolute top-4 right-4 text-5xl font-display font-bold text-white/[0.03]">{s.num}</div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: "rgba(249,115,22,0.12)" }}>
                <s.icon className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="font-display font-semibold text-lg text-white mb-2">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}