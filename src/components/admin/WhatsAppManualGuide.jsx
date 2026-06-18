import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  "Entra en tu cuenta YCloud (ycloud.com)",
  'Ve a "WhatsApp accounts" → selecciona tu WABA',
  'Haz clic en "+ Phone numbers"',
  "Introduce el número del cliente (+34XXXXXXXXX)",
  "Elige verificación por llamada de voz",
  "El cliente recibe la llamada → introduce el código",
  "Copia el WABA ID y el Phone Number ID de YCloud",
  "Vuelve aquí y pégalos en los campos de arriba",
  "Activa WhatsApp y elige el modo de atención",
  'Pulsa "Registrar webhook en YCloud" (solo una vez, la primera)',
  "Envía un mensaje de prueba para verificar",
];

export default function WhatsAppManualGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5">
      <Button type="button" variant="ghost" onClick={() => setOpen(!open)}
        className="w-full justify-between text-white/70 hover:text-white hover:bg-white/5 px-4 py-3">
        <span className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> 📖 Guía de alta manual</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </Button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {STEPS.map((step, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="text-orange-400 font-bold shrink-0">{i + 1}.</span>
              <span className="text-white/70">{step}</span>
            </div>
          ))}
          <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
            <p className="text-xs text-red-300">⚠️ El número no puede estar activo en WhatsApp personal ni Business App</p>
          </div>
        </div>
      )}
    </div>
  );
}