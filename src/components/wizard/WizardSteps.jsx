import { Check } from "lucide-react";
import { motion } from "framer-motion";

export default function WizardSteps({ step, steps }) {
  return (
    <div className="flex items-center justify-center gap-2 md:gap-4 mb-10">
      {steps.map((s, i) => {
        const num = i + 1;
        const isActive = step === num;
        const isDone = step > num;
        return (
          <div key={s} className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${isActive ? "bg-gradient-to-br from-violet-500 to-blue-500 text-white border-transparent glow-purple" : isDone ? "bg-primary/20 text-primary border-primary/40" : "bg-secondary text-muted-foreground border-border"}`}>
                {isDone ? <Check className="w-4 h-4" /> : num}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            </div>
            {i < steps.length - 1 && <div className={`h-px w-8 md:w-16 ${isDone ? "bg-primary/40" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}