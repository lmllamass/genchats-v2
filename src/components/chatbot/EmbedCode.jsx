import { useState } from "react";
import { Copy, Check, Code, Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function EmbedCode({ proyecto }) {
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const config = proyecto?.chatbot_config || {};

  const configuredAppUrl = import.meta.env.VITE_APP_URL || "https://v2.genchats.app";
  const domain = window.location.hostname === "localhost" ? window.location.origin : configuredAppUrl;
  const publicUrl = `${domain}/chat/${proyecto?.id}`;

  const embedHtml = `<!-- Chatbot ${config.nombre_negocio || proyecto?.nombre} -->
<div id="chatbot-widget"></div>
<script>
(function() {
  var w = document.createElement('div');
  w.id = 'chatbot-frame-wrap';
  w.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;';
  w.innerHTML = '<iframe src="${publicUrl}" style="width:400px;height:520px;border:none;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.15);" allow="clipboard-write"></iframe>';
  document.body.appendChild(w);
})();
</script>`;

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedHtml);
    setCopiedEmbed(true);
    toast.success("Código copiado al portapapeles");
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedUrl(true);
    toast.success("URL copiada al portapapeles");
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Public URL */}
      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-display font-semibold">URL pública del chatbot</h3>
            <p className="text-xs text-muted-foreground">Comparte este enlace para que cualquiera pueda usar el chatbot</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-background/80 rounded-lg px-4 py-2.5 text-sm text-muted-foreground border border-border truncate font-mono">
            {publicUrl}
          </div>
          <Button onClick={handleCopyUrl} size="sm" variant="outline">
            {copiedUrl ? <><Check className="w-3 h-3 mr-1" /> Copiado</> : <><Copy className="w-3 h-3 mr-1" /> Copiar</>}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" /> Abrir
            </a>
          </Button>
        </div>
      </div>

      {/* Embed Code */}
      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Code className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-display font-semibold">Código para embeber</h3>
            <p className="text-xs text-muted-foreground">Pega este código en tu web para mostrar el chatbot como widget flotante</p>
          </div>
        </div>
        <div className="relative">
          <pre className="bg-background/80 rounded-lg p-4 text-xs text-muted-foreground overflow-x-auto max-h-48 border border-border">
            {embedHtml}
          </pre>
          <Button onClick={handleCopyEmbed} size="sm" variant="outline" className="absolute top-2 right-2">
            {copiedEmbed ? <><Check className="w-3 h-3 mr-1" /> Copiado</> : <><Copy className="w-3 h-3 mr-1" /> Copiar</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
