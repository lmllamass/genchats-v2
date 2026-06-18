import { Check } from "lucide-react";
import { TEMPLATES } from "@/lib/templates";
import TemplatePreview from "@/components/TemplatePreview";
import ColorSwatch from "@/components/ColorSwatch";

export default function TemplateSelector({ plantilla, esquema, onPlantillaChange, onEsquemaChange }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">Plantilla</h3>
        <p className="text-xs text-muted-foreground mb-4">Elige el estilo visual de tu página.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(TEMPLATES).map(([key, tpl]) => {
            const active = plantilla === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPlantillaChange(key)}
                className={`relative text-left p-2.5 rounded-xl border transition-all ${
                  active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-muted-foreground/30 bg-card/40"
                }`}
              >
                <TemplatePreview template={key} scheme={esquema} />
                <div className="mt-2">
                  <div className="text-xs font-semibold flex items-center gap-1">
                    <span>{tpl.emoji}</span>{tpl.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground line-clamp-1">{tpl.description}</div>
                </div>
                {active && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">Esquema de color</h3>
        <p className="text-xs text-muted-foreground mb-4">Las miniaturas se actualizan en tiempo real.</p>
        <ColorSwatch value={esquema} onChange={onEsquemaChange} />
      </div>
    </div>
  );
}