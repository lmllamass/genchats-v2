import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CTASection({ onCTA }) {
  return (
    <section className="py-20 md:py-28 border-t border-white/5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-violet-600/20 to-indigo-600/20" />
      <div className="absolute inset-0 bg-[#0a0a0f]/60" />
      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            ¿Listo para tener una web profesional?
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Miles de pymes ya modernizaron su imagen. Es tu turno.
          </p>
          <Button size="lg" onClick={onCTA} className="h-14 px-10 text-base bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 shadow-lg shadow-indigo-500/25 border-0">
            Crear mi web ahora — desde 9,90€ <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}