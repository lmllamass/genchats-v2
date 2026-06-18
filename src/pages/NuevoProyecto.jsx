import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import WizardSteps from "@/components/wizard/WizardSteps";
import Step1Url from "@/components/wizard/Step1Url";
import Step2Style from "@/components/wizard/Step2Style";
import Step3Generate from "@/components/wizard/Step3Generate";
import UpgradeWall from "@/components/UpgradeWall";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2 } from "lucide-react";

const STEPS = ["URL & Scraping", "Configuración", "Crear Chatbot"];

export default function NuevoProyecto() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    url_origen: "", nombre: "", contenido_scrapeado: "", metadata_scrapeado: null,
    plantilla_elegida: "moderna", esquema_color: "azul_profesional",
  });
  const { canCreateProject, trialExpired, hasAccess, loading } = useSubscription();

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!hasAccess) return <div className="px-6 md:px-10 py-12"><UpgradeWall reason="expired" /></div>;
  if (!canCreateProject) return <div className="px-6 md:px-10 py-12"><UpgradeWall reason="limit" /></div>;

  return (
    <div className="px-6 md:px-10 py-8 md:py-12 max-w-5xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver al dashboard
      </Link>
      <div className="text-center mb-10">
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">Asistente</div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Crear <span className="gradient-text">nuevo chatbot</span></h1>
      </div>
      <WizardSteps step={step} steps={STEPS} />
      {step === 1 && <Step1Url data={data} setData={setData} onNext={() => setStep(2)} />}
      {step === 2 && <Step2Style data={data} setData={setData} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
      {step === 3 && <Step3Generate data={data} onBack={() => setStep(2)} />}
    </div>
  );
}