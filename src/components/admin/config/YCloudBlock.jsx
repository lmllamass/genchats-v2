import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wifi, WifiOff, Globe } from "lucide-react";
import { api } from "@/api/backendApi";
import { toast } from "sonner";
import MaskedField from "./MaskedField";

const WEBHOOK_URL = "https://api.genchats.app/api/ycloud/webhook";

export default function YCloudBlock({ form, setField }) {
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [registering, setRegistering] = useState(false);

  const verify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch("https://api.ycloud.com/v2/balance", {
        headers: { "X-API-Key": form.ycloud_api_key }
      });
      if (res.ok) {
        const data = await res.json();
        setVerifyResult({ ok: true, msg: `✅ Conectado — Saldo: ${data.balance ?? "N/A"}€` });
      } else {
        setVerifyResult({ ok: false, msg: "❌ API Key inválida" });
      }
    } catch {
      setVerifyResult({ ok: false, msg: "❌ Error de conexión" });
    }
    setVerifying(false);
  };

  const registerWebhook = async () => {
    setRegistering(true);
    try {
      const d = await api.registrarWebhook();
      if (d?.ok) {
        toast.success(d.status === "ya_existia" ? "Webhook ya registrado" : "✅ Webhook creado correctamente");
        setField("ycloud_webhook_id", d.id);
      } else {
        toast.error(d?.error || "Error registrando webhook");
      }
    } catch (e) {
      toast.error(e.message);
    }
    setRegistering(false);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
          <Globe className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">YCloud</h3>
          <p className="text-[11px] text-white/40">API key maestra y webhook</p>
        </div>
      </div>

      <MaskedField label="API Key YCloud (maestra)" value={form.ycloud_api_key} onChange={v => setField("ycloud_api_key", v)} placeholder="Pega tu API key" showCopy />

      <MaskedField
        label="API Key YCloud Agencia (para crear cuentas WhatsApp automáticamente)"
        value={form.ycloud_agency_api_key}
        onChange={v => setField("ycloud_agency_api_key", v)}
        placeholder="Clave de agencia Tech Partner (opcional)"
        showCopy
      />
      <p className="text-[10px] text-white/30 -mt-2">Solo disponible cuando YCloud activa tu cuenta de agencia. Permite crear cuentas WhatsApp Business por API.</p>

      <div>
        <label className="text-xs text-orange-300/80 mb-1 block font-medium">Webhook URL</label>
        <div className="flex gap-2 items-center">
          <div className="flex-1 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-orange-300 font-mono break-all select-all">
            {WEBHOOK_URL}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success("📋 URL copiada"); }}
            className="text-orange-400 hover:text-orange-300 shrink-0 border border-orange-500/30 hover:bg-orange-500/10">
            📋 Copiar
          </Button>
        </div>
        <p className="text-[10px] text-orange-400/60 mt-1">⬆ Esta es la URL que debes pegar en YCloud</p>
      </div>

      <MaskedField label="Webhook ID (tras registrar)" value={form.ycloud_webhook_id} onChange={v => setField("ycloud_webhook_id", v)} placeholder="Se rellena automáticamente" />

      <div>
        <label className="text-xs text-orange-300/80 mb-1 block font-medium">Modo de alta</label>
        <Select value={form.ycloud_modo || "manual"} onValueChange={v => setField("ycloud_modo", v)}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white/90 w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="automatico">Automático (requiere Tech Partner)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button type="button" onClick={verify} disabled={verifying || !form.ycloud_api_key} size="sm"
          className="bg-green-600/20 text-green-300 border border-green-500/30 hover:bg-green-600/30">
          {verifying ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wifi className="w-4 h-4 mr-1" />}
          Verificar conexión
        </Button>
        <Button type="button" onClick={registerWebhook} disabled={registering || !form.ycloud_api_key} size="sm"
          className="bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30">
          {registering ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Globe className="w-4 h-4 mr-1" />}
          Registrar webhook en YCloud
        </Button>
      </div>
      {verifyResult && (
        <p className={`text-sm font-medium ${verifyResult.ok ? "text-green-400" : "text-red-400"}`}>{verifyResult.msg}</p>
      )}
    </div>
  );
}