import MaskedField from "./MaskedField";
import { Globe } from "lucide-react";

export default function FirecrawlBlock({ form, setField }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center">
          <Globe className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">Firecrawl <span className="text-[10px] font-normal text-orange-400/70 ml-1 uppercase tracking-wider">Scraping</span></h3>
          <p className="text-[11px] text-white/40">Extracción de contenido web para generar chatbots y páginas</p>
        </div>
      </div>

      <MaskedField
        label="API Key de Firecrawl"
        value={form.firecrawl_api_key}
        onChange={v => setField("firecrawl_api_key", v)}
        placeholder="fc-..."
        showCopy
        hint="Obtén tu API key en firecrawl.dev/app/api-keys"
      />
    </div>
  );
}
