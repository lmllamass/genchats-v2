import { useState } from "react";
import { Proyecto } from "@/api/entidades";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const MODES = [
  { value: "bot", emoji: "🤖", label: "Bot", desc: "Solo IA responde" },
  { value: "coexistencia", emoji: "👥", label: "Coexistencia", desc: "IA + humano" },
  { value: "humano", emoji: "🧑", label: "Humano", desc: "Solo humano responde" },
];

export default function WhatsAppModeSelector({ proyecto }) {
  const [mode, setMode] = useState(proyecto.modo_atencion || "bot");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleChange = async (newMode) => {
    setMode(newMode);
    setSaving(true);
    await Proyecto.update(proyecto.id, { modo_atencion: newMode });
    queryClient.invalidateQueries({ queryKey: ["proyecto", proyecto.id] });
    setSaving(false);
    toast.success(`Modo cambiado a: ${MODES.find(m => m.value === newMode)?.label}`);
  };

  return (
    <div className="space-y-2">
      <span className="text-xs text-muted-foreground font-medium">Modo de atención</span>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map(m => (
          <button
            key={m.value}
            onClick={() => handleChange(m.value)}
            disabled={saving}
            className={`flex flex-col items-center gap-1 p-2.5 rounded-lg text-xs transition-all border ${
              mode === m.value
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/50"
            }`}
          >
            <span className="text-base">{m.emoji}</span>
            <span className="font-medium">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
