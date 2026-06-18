import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingNav({ onLogin, isAuth }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-lg text-white tracking-tight">PageGen <span className="text-slate-400 font-normal text-sm">AI</span></span>
        </div>
        <Button size="sm" onClick={onLogin} className="bg-white/10 hover:bg-white/15 text-white border-0 backdrop-blur">
          {isAuth ? "Ir al Dashboard" : "Iniciar sesión"}
        </Button>
      </div>
    </nav>
  );
}