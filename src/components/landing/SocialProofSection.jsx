import { motion } from "framer-motion";

const METRICS = [
  { value: "< 5 min", label: "Tiempo medio de generación" },
  { value: "+ 600 webs", label: "Páginas generadas" },
  { value: "98%", label: "Clientes satisfechos" },
];

const TECHS = ["Firecrawl", "HTML5", "WordPress", "Tailwind CSS", "React", "Deno"];

export default function SocialProofSection() {
  return (
    <section className="py-16 border-t border-white/5 bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <p className="text-sm text-slate-500 mb-6">Tecnología de última generación, resultados en minutos</p>
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            {TECHS.map(t => (
              <span key={t} className="text-sm font-medium text-slate-500 tracking-wide">{t}</span>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
          {METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-[#1e1e2e] bg-[#111118] p-6 text-center"
            >
              <div className="text-3xl md:text-4xl font-display font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent mb-2">
                {m.value}
              </div>
              <p className="text-sm text-slate-400">{m.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}