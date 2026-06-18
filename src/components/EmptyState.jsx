import { Link } from "react-router-dom";
import { MessageCircle, ArrowRight } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur p-12 md:p-20 text-center">
      <div className="absolute inset-0 bg-radial-purple pointer-events-none" />
      <div className="relative">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 items-center justify-center glow-purple animate-float">
          <MessageCircle className="w-7 h-7 text-white" />
        </div>
        <h2 className="mt-6 font-display text-3xl md:text-4xl font-bold tracking-tight">
          Tu primer chatbot te espera
        </h2>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto">
          Pega cualquier URL y deja que GenChats IA cree un chatbot inteligente con toda la info de tu negocio.
        </p>
        <Link
          to="/nuevo"
          className="inline-flex items-center gap-2 mt-8 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white font-medium hover:scale-[1.02] transition-transform glow-purple"
        >
          Crear nuevo chatbot <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}