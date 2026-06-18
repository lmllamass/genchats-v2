import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Settings } from "lucide-react";

export default function GeneralBlock({ form, setField }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center">
          <Settings className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">General</h3>
          <p className="text-[11px] text-white/40">Límites y notas</p>
        </div>
      </div>

      <div>
        <label className="text-xs text-orange-300/80 mb-1 block font-medium">Límite de mensajes por proyecto/mes</label>
        <Input type="number" value={form.limite_mensajes_global ?? 200}
          onChange={e => setField("limite_mensajes_global", Number(e.target.value))}
          className="bg-white/5 border-white/10 text-white/90 w-40" min={0} />
      </div>

      <div>
        <label className="text-xs text-orange-300/80 mb-1 block font-medium">Notas del admin</label>
        <Textarea value={form.notas_admin || ""}
          onChange={e => setField("notas_admin", e.target.value)}
          placeholder="Notas internas..."
          className="bg-white/5 border-white/10 text-white/90 min-h-[80px]" />
      </div>
    </div>
  );
}