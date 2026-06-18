import { MessageCircle } from "lucide-react";

export default function LandingFooter() {
  return (
    <footer className="border-t border-white/5 py-12" style={{ backgroundColor: "#0d1117" }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
              <MessageCircle className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-white text-sm">GenChats IA</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
            <a href="#precios" className="hover:text-orange-400 transition-colors">Precios</a>
            <a href="#como-funciona" className="hover:text-orange-400 transition-colors">Cómo funciona</a>
            <a href="/privacidad" className="hover:text-orange-400 transition-colors">Privacidad</a>
            <a href="/cookies" className="hover:text-orange-400 transition-colors">Cookies</a>
            <a href="/aviso-legal" className="hover:text-orange-400 transition-colors">Aviso Legal</a>
            <a href="https://wa.me/34689656122" target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition-colors">Contacto</a>
          </div>

          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} GenChats IA by{" "}
            <a href="https://konkabeza.es" target="_blank" rel="noopener noreferrer" className="text-orange-500/70 hover:text-orange-400">
              Konkabeza
            </a>{" "}
            — Todos los derechos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}