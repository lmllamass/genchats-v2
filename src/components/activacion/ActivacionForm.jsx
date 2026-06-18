import { useState } from "react";
import { Proyecto } from "@/api/entidades";
import { api } from "@/api/backendApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircle, Send, PartyPopper } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function ActivacionForm({ proyecto, onComplete }) {
  const [whatsappOption, setWhatsappOption] = useState("propio");
  const [whatsappNumero, setWhatsappNumero] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (whatsappOption === "propio" && !whatsappNumero.trim()) {
      return toast.error("Introduce tu número de WhatsApp Business");
    }

    setSaving(true);

    const updateData = {
      whatsapp_numero_propio: whatsappOption === "propio",
      onboarding_completado: true,
      chatbot_config: {
        ...proyecto.chatbot_config,
        whatsapp_numero: whatsappOption === "propio" ? whatsappNumero.trim() : "",
      },
    };
    if (telegramUsername.trim()) {
      updateData.telegram_username = telegramUsername.trim().replace(/^@/, "");
    }

    await Proyecto.update(proyecto.id, updateData);

    // Send notification to admin
    const body = `Nuevo onboarding Pro completado\nProyecto: ${proyecto.nombre} (ID: ${proyecto.id})\nNegocio: ${proyecto.chatbot_config?.nombre_negocio || "N/A"}\nURL: ${proyecto.url_origen}\nWhatsApp: ${whatsappOption === "propio" ? `Número propio: ${whatsappNumero}` : "Necesita número nuevo"}\nTelegram: ${telegramUsername || "No proporcionado"}`;

    await api.notifyLead({
      notification_email: "info@konkabeza.es",
      nombre_negocio: `Onboarding Pro: ${proyecto.nombre}`,
      lead: { notas: body },
    });

    setSaving(false);
    onComplete();
  };

  return (
    <div className="min-h-screen bg-background bg-grid flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 mx-auto mb-2">
            <PartyPopper className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            ¡Ya eres <span className="gradient-text">Pro</span>!
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Tu chatbot <strong>{proyecto.chatbot_config?.nombre_negocio || proyecto.nombre}</strong> está siendo configurado. Completa estos datos para activar todos tus canales en minutos.
          </p>
        </div>

        {/* Bloque WhatsApp */}
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-lg">Canal WhatsApp</h2>
              <p className="text-xs text-muted-foreground">¿Quieres usar tu número de WhatsApp Business actual?</p>
            </div>
          </div>

          <div className="space-y-3">
            <label
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                whatsappOption === "propio"
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-border hover:border-border/80"
              }`}
              onClick={() => setWhatsappOption("propio")}
            >
              <input type="radio" name="wa" checked={whatsappOption === "propio"} onChange={() => setWhatsappOption("propio")} className="mt-1 accent-green-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">✅ Sí, usar mi número actual</div>
                <p className="text-xs text-muted-foreground mt-1">Vinculamos tu chatbot a tu número de WhatsApp Business existente.</p>
                {whatsappOption === "propio" && (
                  <Input
                    value={whatsappNumero}
                    onChange={e => setWhatsappNumero(e.target.value)}
                    placeholder="+34612345678"
                    className="mt-3 bg-secondary/50 border-border"
                    onClick={e => e.stopPropagation()}
                  />
                )}
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                whatsappOption === "nuevo"
                  ? "border-blue-500/50 bg-blue-500/5"
                  : "border-border hover:border-border/80"
              }`}
              onClick={() => setWhatsappOption("nuevo")}
            >
              <input type="radio" name="wa" checked={whatsappOption === "nuevo"} onChange={() => setWhatsappOption("nuevo")} className="mt-1 accent-blue-500" />
              <div>
                <div className="text-sm font-medium">📱 No, quiero un número nuevo</div>
                <p className="text-xs text-muted-foreground mt-1">Nuestro equipo te asignará un número dedicado. Te contactaremos en menos de 24h.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Bloque Telegram */}
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Send className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-lg">Canal Telegram <span className="text-xs text-muted-foreground font-normal">(opcional)</span></h2>
              <p className="text-xs text-muted-foreground">Si quieres que tu chatbot también atienda en Telegram, indícanos tu usuario.</p>
            </div>
          </div>
          <Input
            value={telegramUsername}
            onChange={e => setTelegramUsername(e.target.value)}
            placeholder="@miFerreteria"
            className="bg-secondary/50 border-border"
          />
          <p className="text-[11px] text-muted-foreground">Crearemos un bot de Telegram vinculado a tu cuenta automáticamente.</p>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full h-14 text-base bg-gradient-to-r from-violet-500 to-blue-500 hover:opacity-90 glow-purple rounded-xl"
        >
          {saving ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Guardando...</>
          ) : (
            "✅ Confirmar y activar"
          )}
        </Button>
      </motion.div>
    </div>
  );
}
