import { motion } from "framer-motion";
import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Carlos M.",
    city: "Ferretería El Tornillo, Madrid",
    text: "Llevaba años con una web que daba vergüenza. En 5 minutos tenía una página profesional que me da orgullo enseñar a los clientes.",
    initials: "CM",
  },
  {
    name: "Ana P.",
    city: "Floristería Rosa Blanca, Valencia",
    text: "No sé nada de diseño web y PageGen AI me generó una página preciosa. La subí a mi hosting en 10 minutos y ya recibo pedidos online.",
    initials: "AP",
  },
  {
    name: "Miguel R.",
    city: "Taller Mecánico Rápido, Sevilla",
    text: "Pagaba 50€/mes por una web que nunca actualizaba. Ahora la gestiono yo mismo y me ahorro un dineral. Muy recomendable.",
    initials: "MR",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-20 md:py-28 border-t border-white/5 bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-400 mb-3">Testimonios</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight">Lo que dicen nuestros clientes</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-[#1e1e2e] bg-[#111118] p-6"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-5">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white">
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.city}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}