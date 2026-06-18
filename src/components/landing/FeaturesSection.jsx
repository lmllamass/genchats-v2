import { motion } from "framer-motion";
import { Zap, Palette, Package, Plug, Smartphone, Lock } from "lucide-react";

const FEATURES = [
  { icon: Zap, title: "Generación instantánea", desc: "De URL a web en menos de 5 minutos" },
  { icon: Palette, title: "Editor visual", desc: "Cambia textos, colores y contenido sin código" },
  { icon: Package, title: "Export en ZIP", desc: "Listo para subir a cualquier hosting" },
  { icon: Plug, title: "Compatible WordPress", desc: "Copia y pega en tu WordPress al instante" },
  { icon: Smartphone, title: "100% Responsive", desc: "Perfecta en móvil, tablet y escritorio" },
  { icon: Lock, title: "Sin dependencias", desc: "HTML autocontenido, sin plugins ni librerías" },
];

export default function FeaturesSection() {
  return (
    <section className="py-20 md:py-28 border-t border-white/5 bg-[#111118]/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-400 mb-3">Características</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight">Todo lo que necesitas</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-[#1e1e2e] bg-[#111118] p-6 hover:border-indigo-500/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/15 transition-colors">
                <f.icon className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="font-display font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}