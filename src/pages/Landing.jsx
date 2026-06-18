import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import HeroSection from "@/components/landing/HeroSection.jsx";
import PricingSection from "@/components/landing/PricingSection.jsx";
import HowItWorksSection from "@/components/landing/HowItWorksSection.jsx";
import IntegrationsSection from "@/components/landing/IntegrationsSection.jsx";
import LandingFooter from "@/components/landing/LandingFooter.jsx";
import ContactModal from "@/components/landing/ContactModal.jsx";
import CookieBanner from "@/components/landing/CookieBanner.jsx";
import GenaFloatingWidget from "@/components/gena/GenaFloatingWidget";

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated, navigateToLogin } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);

  const handleCTA = () => {
    if (isAuthenticated) navigate("/nuevo");
    else navigateToLogin("/nuevo");
  };

  const handleDemo = () => {
    navigate("/demo");
  };

  return (
    <div style={{ backgroundColor: "#0d1117", minHeight: "100vh", color: "#f8fafc" }}>
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5" style={{ backgroundColor: "rgba(13,17,23,0.95)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
              <span className="text-white text-sm">💬</span>
            </div>
            <span className="font-display font-bold text-white text-lg tracking-tight">
              GenChats <span className="text-slate-500 font-normal text-sm">IA</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <a href="#precios" className="hover:text-white transition-colors">Precios</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">Cómo funciona</a>
          </div>
          <button
            onClick={handleCTA}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90"
            style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)" }}
          >
            {isAuthenticated ? "Ir al Dashboard" : "Iniciar sesión"}
          </button>
        </div>
      </nav>

      <HeroSection onCTA={handleCTA} onDemo={handleDemo} />
      <PricingSection onCTA={handleCTA} onContact={() => setContactOpen(true)} />
      <HowItWorksSection />
      <IntegrationsSection />
      <LandingFooter />

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
      <CookieBanner />
      <GenaFloatingWidget />
    </div>
  );
}
