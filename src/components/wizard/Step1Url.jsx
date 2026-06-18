import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Proyecto } from "@/api/entidades";
import { api } from "@/api/backendApi";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

export default function Step1Url({ data, setData, onNext }) {
  const [url, setUrl] = useState(data.url_origen || "");
  const [nombre, setNombre] = useState(data.nombre || "");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleAnalyze = async () => {
    if (!url.trim()) return toast.error("Introduce una URL");
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = "https://" + normalized;
    setLoading(true);

    try {
      if (user?.id) {
        const existing = await Proyecto.list(user.id);
        const duplicate = existing.find(p => p.url_origen === normalized && p.estado !== "revision");
        if (duplicate) {
          toast.error("Ya tienes un proyecto con esta URL. ¿Quieres editarlo en su lugar?", {
            action: { label: "Ir al editor", onClick: () => window.location.href = `/editor/${duplicate.id}` },
            duration: 8000,
          });
          return;
        }
      }

      const res = await api.scrape(normalized);
      const { metadata, markdown, sections, images, branding } = res || {};
      if (!metadata) { toast.error("No se pudo analizar la URL"); return; }
      setData(prev => ({
        ...prev,
        url_origen: normalized,
        nombre: nombre || metadata.title || "Proyecto sin título",
        contenido_scrapeado: (markdown || '').slice(0, 12000),
        metadata_scrapeado: metadata,
        scraped_sections: sections || [],
        scraped_images: images || [],
        scraped_branding: branding || {},
      }));
      toast.success("Página analizada");
    } catch (err) {
      toast.error("Error al analizar la URL: " + (err.message || "Inténtalo de nuevo"));
    } finally {
      setLoading(false);
    }
  };

  const meta = data.metadata_scrapeado;
  const preview = (data.contenido_scrapeado || "").slice(0, 800);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <h2 className="font-display text-2xl font-semibold mb-1">URL de origen</h2>
        <p className="text-sm text-muted-foreground mb-6">Pega la URL de tu negocio para crear un chatbot con su información.</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">URL</label>
            <div className="relative">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://ejemplo.com" className="pl-10 h-12 bg-secondary/50 border-border" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nombre del proyecto (opcional)</label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Se usará el título detectado si lo dejas vacío" className="h-12 bg-secondary/50 border-border" />
          </div>
        </div>
      </div>

      {/* Botón analizar */}
      {!meta && (
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <Button onClick={handleAnalyze} disabled={loading || !url.trim()} className="w-full h-12 bg-gradient-to-r from-violet-500 to-blue-500 hover:opacity-90 glow-purple">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analizando…</> : <><Sparkles className="w-4 h-4 mr-2" /> Analizar página</>}
          </Button>
        </div>
      )}

      {meta && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-primary/30 bg-card p-6 md:p-8">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary mb-1">Detectado</div>
          <h3 className="font-display text-xl font-semibold leading-tight truncate">{meta.title || "Sin título"}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{meta.description || "Sin descripción"}</p>
          {meta.tiene_ecommerce && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 text-green-400 px-3 py-1 text-xs font-medium">
                🛒 E-commerce detectado
              </span>
              {meta.plataforma_ecommerce && meta.plataforma_ecommerce !== 'otro' && (
                <span className="text-muted-foreground capitalize">{meta.plataforma_ecommerce}</span>
              )}
            </div>
          )}
          {preview && (
            <div className="mt-5">
              <div className="text-xs font-medium text-muted-foreground mb-2">Contenido extraído</div>
              <div className="text-sm bg-background/60 rounded-lg p-4 max-h-48 overflow-auto whitespace-pre-wrap text-muted-foreground leading-relaxed">
                {preview}{(data.contenido_scrapeado || "").length > 800 ? "…" : ""}
              </div>
            </div>
          )}
          <div className="flex justify-end mt-6">
            <Button onClick={onNext} className="bg-gradient-to-r from-violet-500 to-blue-500 hover:opacity-90">
              Continuar <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
