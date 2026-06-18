import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { useConfigPlataforma } from "@/components/admin/config/useConfigPlataforma";
import YCloudBlock from "@/components/admin/config/YCloudBlock";
import MetaBlock from "@/components/admin/config/MetaBlock";
import OpenAIBlock from "@/components/admin/config/OpenAIBlock";
import StripeBlock from "@/components/admin/config/StripeBlock";
import GeneralBlock from "@/components/admin/config/GeneralBlock";
import SystemStatusBlock from "@/components/admin/config/SystemStatusBlock";
import ResendBlock from "@/components/admin/config/ResendBlock";
import FirecrawlBlock from "@/components/admin/config/FirecrawlBlock";

const FIELDS = [
  "ycloud_api_key", "ycloud_agency_api_key", "ycloud_webhook_id", "ycloud_modo",
  "meta_app_id", "meta_config_id", "meta_solution_id", "meta_modo",
  "openai_api_key", "openai_modelo",
  "stripe_secret_key", "stripe_webhook_secret", "stripe_price_id_pro", "stripe_price_id_super_pro", "stripe_price_id_instalacion",
  "firecrawl_api_key",
  "resend_api_key", "resend_from_email",
  "limite_mensajes_global", "notas_admin"
];

export default function AdminConfiguracion() {
  const { config, isLoading, saveMut } = useConfigPlataforma();
  const [form, setForm] = useState({});

  useEffect(() => {
    if (config) {
      const f = {};
      FIELDS.forEach(k => { f[k] = config[k] ?? ""; });
      if (!f.resend_from_email) f.resend_from_email = "noreply@genchats.app";
      if (!f.limite_mensajes_global) f.limite_mensajes_global = 200;
      setForm(f);
    } else if (!isLoading) {
      setForm({
        limite_mensajes_global: 200,
        ycloud_modo: "manual",
        meta_modo: "pendiente",
        openai_modelo: "gpt-4o-mini",
        resend_from_email: "noreply@genchats.app",
      });
    }
  }, [config, isLoading]);

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    const data = { ...form };
    Object.keys(data).forEach(k => { if (data[k] === "") delete data[k]; });
    if (data.limite_mensajes_global) data.limite_mensajes_global = Number(data.limite_mensajes_global);
    saveMut.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 py-8 md:py-12 max-w-[1200px] mx-auto" style={{ background: "#0a0f1e", minHeight: "100vh" }}>
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.25em] text-orange-400/60 mb-2">Panel Admin</div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-white">
          Configuración <span className="text-orange-400">Plataforma</span>
        </h1>
        <p className="text-white/40 mt-2">Gestiona las credenciales y servicios de GenChat IA</p>
      </div>

      <div className="space-y-6">
        <SystemStatusBlock config={form} />
        <OpenAIBlock form={form} setField={setField} />
        <FirecrawlBlock form={form} setField={setField} />
        <YCloudBlock form={form} setField={setField} />
        <MetaBlock form={form} setField={setField} />
        <StripeBlock form={form} setField={setField} />
        <ResendBlock form={form} setField={setField} />
        <GeneralBlock form={form} setField={setField} />
      </div>

      <div className="mt-8 sticky bottom-4">
        <Button onClick={handleSave} disabled={saveMut.isPending} size="lg"
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 text-white font-semibold shadow-lg shadow-orange-500/20 w-full md:w-auto">
          {saveMut.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
          Guardar toda la configuración
        </Button>
      </div>
    </div>
  );
}