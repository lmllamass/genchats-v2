import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, X, Send } from "lucide-react";
import { api } from "@/api/backendApi";
import { toast } from "sonner";

export default function TestMessageModal({ proyectoId, onClose }) {
  const [to, setTo] = useState("");
  const [mensaje, setMensaje] = useState("Hola, este es un mensaje de prueba de GenChat IA 🤖");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!to || !mensaje) return toast.error("Rellena todos los campos");
    setSending(true);
    try {
      const res = await api.enviarMensajePrueba({ proyecto_id: proyectoId, to, mensaje });
      if (res.ok) {
        toast.success("✅ Mensaje enviado (WAMID: " + res.wamid + ")");
        onClose();
      } else {
        toast.error("❌ " + (res.error || "Error desconocido"));
      }
    } catch (e) {
      toast.error(e.message);
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#0f1629] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-white">🧪 Mensaje de prueba</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white/50 hover:text-white">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div>
          <label className="text-xs text-orange-300/80 mb-1 block">Número destino</label>
          <Input value={to} onChange={e => setTo(e.target.value)} placeholder="+34612345678"
            className="bg-white/5 border-white/10 text-white/90" />
        </div>
        <div>
          <label className="text-xs text-orange-300/80 mb-1 block">Mensaje</label>
          <Input value={mensaje} onChange={e => setMensaje(e.target.value)}
            className="bg-white/5 border-white/10 text-white/90" />
        </div>
        <Button onClick={send} disabled={sending} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 text-white">
          {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Enviar mensaje
        </Button>
      </div>
    </div>
  );
}
