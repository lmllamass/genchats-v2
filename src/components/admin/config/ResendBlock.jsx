import MaskedField from "./MaskedField";
import { Mail } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function ResendBlock({ form, setField }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-teal-500/20 flex items-center justify-center">
          <Mail className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">Resend <span className="text-[10px] font-normal text-teal-400/70 ml-1 uppercase tracking-wider">Email</span></h3>
          <p className="text-[11px] text-white/40">Servicio de envío de emails (notificaciones de leads, activaciones, etc.)</p>
        </div>
      </div>

      <MaskedField
        label="API Key de Resend"
        value={form.resend_api_key}
        onChange={v => setField("resend_api_key", v)}
        placeholder="re_..."
        showCopy
        hint="Obtén tu API key en resend.com/api-keys"
      />

      <div>
        <label className="text-xs text-orange-300/80 mb-1 block font-medium">Email remitente (From)</label>
        <Input
          type="email"
          value={form.resend_from_email || ""}
          onChange={e => setField("resend_from_email", e.target.value)}
          placeholder="noreply@tudominio.com"
          className="bg-white/5 border-white/10 text-white/90 placeholder:text-white/30"
        />
        <p className="text-[10px] text-white/30 mt-1">Debe ser un dominio verificado en Resend</p>
      </div>
    </div>
  );
}
