import { useState, useMemo } from "react";
import { MessageCircle, ExternalLink, Copy, Check, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { appParams } from "@/lib/app-params";

export default function WhatsAppConfig({ proyecto, onUpdate }) {
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const webhookUrl = useMemo(() => {
    const base = appParams.appBaseUrl || window.location.origin;
    return `${base}/api/functions/ycloudWebhook`;
  }, []);

  const apiKey = proyecto.ycloud_api_key || "";
  const phoneNumber = proyecto.ycloud_phone_number || "";
  const active = proyecto.whatsapp_activo || false;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-green-400" />
        </div>
        <h4 className="text-sm font-semibold">Canal WhatsApp</h4>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">API Key de YCloud</label>
          <Input
            type="password"
            placeholder="Pega tu API Key aquí"
            value={apiKey}
            onChange={(e) => onUpdate({ ycloud_api_key: e.target.value })}
            className="bg-secondary/50 text-sm"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Obtén tu API Key en YCloud Dashboard → Developer → API Keys
          </p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tu número de WhatsApp Business</label>
          <Input
            placeholder="+34612345678"
            value={phoneNumber}
            onChange={(e) => onUpdate({ ycloud_phone_number: e.target.value })}
            className="bg-secondary/50 text-sm"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Formato internacional: +34...</p>
        </div>

        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30">
          <span className="text-sm">Activar canal WhatsApp</span>
          <Switch checked={active} onCheckedChange={(v) => onUpdate({ whatsapp_activo: v })} />
        </div>

        <a
          href="https://app.ycloud.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> Abrir YCloud Dashboard
        </a>
      </div>

      {/* Setup guide */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Cómo configurarlo</span>
          {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showGuide && (
          <div className="px-3 pb-3 space-y-3 text-xs text-muted-foreground">
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">Paso 1: Configura el webhook en YCloud</p>
              <p>Entra en tu cuenta YCloud → Developer → Webhooks → Add Endpoint</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2 py-1.5 rounded bg-secondary text-[10px] break-all select-all">
                  {webhookUrl}
                </code>
                <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={handleCopyUrl}>
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <p>Evento a activar: <code className="px-1 py-0.5 rounded bg-secondary text-[10px]">whatsapp.inbound_message.received</code></p>
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-foreground">Paso 2: Copia tu API Key</p>
              <p>En YCloud → Developer → API Keys, copia tu clave y pégala en el campo de arriba.</p>
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-foreground">Paso 3: Activa y guarda</p>
              <p>Activa el toggle de arriba y pulsa "Guardar cambios". ¡Listo!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}