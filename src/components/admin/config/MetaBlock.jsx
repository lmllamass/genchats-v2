import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import MaskedField from "./MaskedField";

export default function MetaBlock({ form, setField }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <span className="text-lg">📱</span>
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">Meta / Embedded Signup</h3>
          <p className="text-[11px] text-white/40">Configuración de Facebook Login for Business</p>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-300">
          ⚠️ Pendiente de aprobación Tech Partner (2-4 semanas). Rellena estos datos cuando YCloud te los facilite.
        </p>
      </div>

      <MaskedField label="Facebook App ID" value={form.meta_app_id} onChange={v => setField("meta_app_id", v)} placeholder="Tu App ID" />
      <MaskedField label="Facebook Config ID" value={form.meta_config_id} onChange={v => setField("meta_config_id", v)} placeholder="Login for Business Configuration ID" />
      <MaskedField label="Solution ID (YCloud)" value={form.meta_solution_id} onChange={v => setField("meta_solution_id", v)} placeholder="Solution ID" />

      <div>
        <label className="text-xs text-orange-300/80 mb-1 block font-medium">Estado Embedded Signup</label>
        <Select value={form.meta_modo || "pendiente"} onValueChange={v => setField("meta_modo", v)}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white/90 w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendiente">● Pendiente (alta manual activa)</SelectItem>
            <SelectItem value="activo">○ Activo (Embedded Signup disponible)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-white/30 mt-1">Cuando cambies a Activo, los clientes podrán conectar su WhatsApp ellos solos.</p>
      </div>
    </div>
  );
}