import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Globe, Sparkles, Palette, Code, MessageCircle, Zap, ShoppingCart, Smartphone, Check, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

const SLIDES = [
  {
    id: 1,
    icon: Globe,
    badge: "Paso 1",
    title: "Pega la URL de tu negocio",
    desc: "Solo necesitas la dirección de tu web. Nuestro motor de IA la analiza en segundos y extrae toda la información: textos, productos, servicios, horarios…",
    visual: "url",
    color: "#6366f1",
  },
  {
    id: 2,
    icon: Sparkles,
    badge: "Paso 2",
    title: "La IA analiza tu web",
    desc: "Extraemos automáticamente el contenido, los productos, la identidad visual y toda la información relevante de tu negocio.",
    visual: "scan",
    color: "#8b5cf6",
  },
  {
    id: 3,
    icon: Palette,
    badge: "Paso 3",
    title: "Personaliza tu chatbot",
    desc: "Elige colores, tono de voz y estilo. Tu chatbot se adapta a la imagen de tu marca en un clic.",
    visual: "style",
    color: "#a78bfa",
  },
  {
    id: 4,
    icon: Code,
    badge: "Paso 4",
    title: "Copia y pega en tu web",
    desc: "Una sola línea de código. Pégala en tu web y tu chatbot estará en vivo atendiendo clientes 24/7.",
    visual: "embed",
    color: "#6366f1",
  },
  {
    id: 5,
    icon: MessageCircle,
    badge: "Paso 5",
    title: "WhatsApp, Telegram y más",
    desc: "Conecta tu chatbot a WhatsApp Business y Telegram. Tus clientes te escriben y el bot responde al instante con la info de tu negocio.",
    visual: "channels",
    color: "#8b5cf6",
  },
];

function SlideVisual({ visual, color }) {
  const common = "w-full max-w-md mx-auto";

  if (visual === "url") {
    return (
      <div className={common}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400/60" /><div className="w-3 h-3 rounded-full bg-yellow-400/60" /><div className="w-3 h-3 rounded-full bg-green-400/60" /></div>
          </div>
          <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ delay: 0.6, duration: 1.2 }}
            className="h-11 rounded-xl bg-white/10 border border-white/10 flex items-center px-4 overflow-hidden">
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
              className="text-sm text-white/70 font-mono whitespace-nowrap">https://miferreteria.com</motion.span>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }}
            className="mt-4 flex justify-end">
            <div className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: `linear-gradient(135deg, ${color}, #8b5cf6)` }}>
              Analizar web →
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (visual === "scan") {
    return (
      <div className={common}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
          {["Nombre del negocio", "Productos detectados: 847", "Horario: L-V 9:00-20:00", "Teléfono: 91 234 56 78", "Servicios: 12 categorías"].map((text, i) => (
            <motion.div key={text} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 + i * 0.3 }}
              className="flex items-center gap-3">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7 + i * 0.3 }}
                className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: color }}>
                <Check className="w-3 h-3 text-white" />
              </motion.div>
              <span className="text-sm text-white/80">{text}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    );
  }

  if (visual === "style") {
    const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];
    return (
      <div className={common}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex gap-3 mb-5">
            {colors.map((c, i) => (
              <motion.div key={c} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.15 }}
                className="w-10 h-10 rounded-xl cursor-pointer border-2 transition-transform hover:scale-110"
                style={{ background: c, borderColor: i === 0 ? "#fff" : "transparent" }} />
            ))}
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
            className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: colors[0] }}>
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-white/90">Mi Chatbot</span>
            </div>
            <div className="space-y-2">
              <div className="h-3 rounded bg-white/10 w-3/4" />
              <div className="h-3 rounded bg-white/10 w-1/2" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (visual === "embed") {
    return (
      <div className={common}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/10 bg-[#1e1e2e] p-5 font-mono text-xs leading-relaxed overflow-hidden">
          <div className="flex items-center gap-2 mb-4 text-white/40">
            <Code className="w-4 h-4" /> index.html
          </div>
          {[
            { text: '<script', color: '#c678dd', delay: 0.5 },
            { text: '  src="https://genchat.ia/widget.js"', color: '#98c379', delay: 0.8 },
            { text: '  data-id="abc123"', color: '#e5c07b', delay: 1.1 },
            { text: '></script>', color: '#c678dd', delay: 1.4 },
          ].map((line, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: line.delay }}>
              <span style={{ color: line.color }}>{line.text}</span>
            </motion.div>
          ))}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}
            className="mt-4 text-green-400 flex items-center gap-2">
            <Check className="w-3.5 h-3.5" /> ¡Listo! Tu chatbot está activo
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (visual === "channels") {
    const channels = [
      { name: "Web Widget", icon: Globe, sub: "Gratis", active: true },
      { name: "WhatsApp", icon: MessageCircle, sub: "Plan Pro", active: true },
      { name: "Telegram", icon: Zap, sub: "Plan Pro", active: true },
      { name: "iMessage", icon: Smartphone, sub: "Próximamente", active: false },
    ];
    return (
      <div className={common}>
        <div className="space-y-3">
          {channels.map((ch, i) => (
            <motion.div key={ch.name} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 + i * 0.2 }}
              className={`rounded-xl border p-4 flex items-center gap-4 ${ch.active ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-50"}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: ch.active ? `${color}33` : "rgba(255,255,255,0.05)" }}>
                <ch.icon className="w-5 h-5" style={{ color: ch.active ? color : "rgba(255,255,255,0.3)" }} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white/90">{ch.name}</div>
                <div className="text-xs text-white/50">{ch.sub}</div>
              </div>
              {ch.active && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 + i * 0.2 }}
                  className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#10b981" }}>
                  <Check className="w-3 h-3 text-white" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

const AUTO_INTERVAL = 5000;

export default function Demo() {
  const navigate = useNavigate();
  const { isAuthenticated, navigateToLogin } = useAuth();
  const [current, setCurrent] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [showFinal, setShowFinal] = useState(false);

  const next = useCallback(() => {
    if (current < SLIDES.length - 1) {
      setCurrent(c => c + 1);
    } else {
      setShowFinal(true);
      setAutoPlay(false);
    }
  }, [current]);

  const prev = () => {
    if (showFinal) { setShowFinal(false); return; }
    if (current > 0) setCurrent(c => c - 1);
  };

  useEffect(() => {
    if (!autoPlay || showFinal) return;
    const t = setInterval(next, AUTO_INTERVAL);
    return () => clearInterval(t);
  }, [autoPlay, current, showFinal, next]);

  const handleCTA = () => {
    if (isAuthenticated) navigate("/app");
    else navigateToLogin("/nuevo");
  };

  const slide = SLIDES[current];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #1a1040 50%, #0a0a0f 100%)" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <button onClick={() => navigate("/")} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "#fff", fontSize: 16 }}>GenChats IA</span>
        </button>
        <Button variant="outline" size="sm" className="border-white/10 text-white/80 hover:bg-white/5" onClick={handleCTA}>
          Probar gratis
        </Button>
      </nav>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-5xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {!showFinal ? (
            <motion.div key={`slide-${current}`} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.5 }}
              className="w-full flex flex-col items-center gap-10">
              {/* Badge */}
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 rounded-full text-xs font-medium border" style={{ borderColor: `${slide.color}55`, color: slide.color, background: `${slide.color}15` }}>
                  {slide.badge}
                </div>
              </div>

              {/* Text */}
              <div className="text-center max-w-xl">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>
                  {slide.title}
                </h2>
                <p className="text-base text-white/60 leading-relaxed">{slide.desc}</p>
              </div>

              {/* Visual */}
              <SlideVisual visual={slide.visual} color={slide.color} />
            </motion.div>
          ) : (
            <motion.div key="final" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
              className="w-full flex flex-col items-center gap-8 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Sparkles className="w-10 h-10 text-white" />
              </motion.div>
              <div>
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>
                  Tu chatbot listo en <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">5 minutos</span>
                </h2>
                <p className="text-lg text-white/60 max-w-lg mx-auto leading-relaxed">
                  Sin programar. Sin complicaciones. Empieza gratis y conecta tu chatbot a web, WhatsApp y Telegram.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
                {[
                  { icon: Zap, label: "100 chats/mes gratis" },
                  { icon: ShoppingCart, label: "Compatible ecommerce" },
                  { icon: MessageCircle, label: "WhatsApp + Telegram" },
                ].map((f, i) => (
                  <motion.div key={f.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.15 }}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col items-center gap-2">
                    <f.icon className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm text-white/80 font-medium">{f.label}</span>
                  </motion.div>
                ))}
              </div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
                <button onClick={handleCTA}
                  className="px-8 py-4 rounded-xl text-base font-semibold text-white transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 0 40px rgba(99,102,241,0.4)" }}>
                  Actívalo gratis por 30 días →
                </button>
                <p className="text-xs text-white/40 mt-3">Sin tarjeta de crédito · Cancela cuando quieras</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="px-6 py-6 flex items-center justify-between max-w-5xl mx-auto w-full">
        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => { setCurrent(i); setShowFinal(false); setAutoPlay(false); }}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === current && !showFinal ? 32 : 8,
                background: i === current && !showFinal ? "#6366f1" : i < current || showFinal ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.15)",
              }} />
          ))}
          <button onClick={() => { setShowFinal(true); setAutoPlay(false); }}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: showFinal ? 32 : 8, background: showFinal ? "#6366f1" : "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoPlay(a => !a)}
            className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">
            {autoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button onClick={prev} disabled={current === 0 && !showFinal}
            className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-30">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button onClick={next} disabled={showFinal}
            className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-30">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
