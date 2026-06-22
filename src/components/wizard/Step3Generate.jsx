import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles, Bot, CheckCircle2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Proyecto } from "@/api/entidades";
import { api } from "@/api/backendApi";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

const APP_URL = import.meta.env.VITE_APP_URL || "https://v2.genchats.app";

export default function Step3Generate({ data, onBack }) {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [proyectoId, setProyectoId] = useState(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const snippetCode = proyectoId
    ? `<!-- Chatbot GenChat IA -->\n<iframe src="${APP_URL}/chat/${proyectoId}" style="position:fixed;bottom:20px;right:20px;width:380px;height:580px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.18);z-index:9999" allow="clipboard-write"></iframe>`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(snippetCode);
    setCopied(true);
    toast.success("Código copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    setGenerating(true);

    // 1. Create the project record
    const createPayload = {
      url_origen: data.url_origen,
      nombre: data.nombre || "Mi Chatbot",
      estado: "generando",
      plantilla_elegida: data.plantilla_elegida || "moderna",
      esquema_color: data.esquema_color || "azul_profesional",
      contenido_scrapeado: data.contenido_scrapeado,
      metadata_scrapeado: data.metadata_scrapeado,
    };
    if (data.ecommerce_config?.enabled) {
      createPayload.ecommerce_config = data.ecommerce_config;
    }
    const proyecto = await Proyecto.create(createPayload, user.id);

    // 2. Generate chatbot config via backend
    const res = await api.generarChatbot(proyecto.id);

    if (res?.error) {
      toast.error("Error al generar el chatbot");
      setGenerating(false);
      return;
    }

    setProyectoId(proyecto.id);
    setDone(true);
    setGenerating(false);
    toast.success("¡Chatbot creado con éxito!");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 text-center">
        {done ? (
          <div className="space-y-6 py-4">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold mb-2">¡Chatbot creado!</h2>
              <p className="text-muted-foreground">Tu chatbot inteligente está listo para usar.</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate("/app")}>
                Ir al dashboard
              </Button>
              <Button onClick={() => navigate(`/editor/${proyectoId}`)} className="bg-gradient-to-r from-violet-500 to-blue-500 hover:opacity-90">
                Editar chatbot
              </Button>
            </div>

            {/* Embed snippet */}
            <div className="mt-6 rounded-xl bg-secondary/50 p-4 text-left max-w-lg mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Snippet de integración</span>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs gap-1.5">
                  {copied ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                </Button>
              </div>
              <pre className="text-xs bg-background/60 rounded-lg p-3 overflow-x-auto text-muted-foreground whitespace-pre-wrap break-all select-all">
                {snippetCode}
              </pre>
              <p className="text-[11px] text-muted-foreground mt-2">Pega este código antes del cierre <code>&lt;/body&gt;</code> de tu web.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold mb-2">Crear chatbot</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Vamos a generar un chatbot inteligente con la información de <strong>{data.nombre || data.url_origen}</strong>.
              </p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4 max-w-sm mx-auto text-left text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">URL</span><span className="truncate ml-4 max-w-[200px]">{data.url_origen}</span></div>
              {data.ecommerce_config?.enabled && (
                <div className="flex justify-between"><span className="text-muted-foreground">E-commerce</span><span className="capitalize">{data.ecommerce_config.platform || "—"}</span></div>
              )}
              {data.chatbot_config?.notification_email && (
                <div className="flex justify-between"><span className="text-muted-foreground">Notificaciones</span><span className="truncate ml-4 max-w-[200px]">{data.chatbot_config.notification_email}</span></div>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={onBack} disabled={generating}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
              </Button>
              <Button onClick={handleGenerate} disabled={generating} className="bg-gradient-to-r from-violet-500 to-blue-500 hover:opacity-90 glow-purple">
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando…</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Crear chatbot</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
