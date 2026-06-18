import { Check } from "lucide-react";
import { COLOR_SCHEMES } from "@/lib/templates";

export default function ColorSwatch({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Object.entries(COLOR_SCHEMES).map(([key, cs]) => {
        const active = value === key;
        return (
          <button key={key} type="button" onClick={() => onChange(key)}
            className={`group relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${active ? "border-primary bg-primary/5" : "border-border hover:border-border/80 bg-card/40"}`}>
            <div className="flex -space-x-2">
              <span className="w-7 h-7 rounded-full ring-2 ring-background" style={{ background: cs.swatch[0] }} />
              <span className="w-7 h-7 rounded-full ring-2 ring-background" style={{ background: cs.swatch[1] }} />
            </div>
            <div className="text-sm font-medium truncate">{cs.name}</div>
            {active && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-primary-foreground" /></div>}
          </button>
        );
      })}
    </div>
  );
}