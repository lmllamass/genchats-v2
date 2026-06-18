import { useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { api } from "@/api/backendApi";
import { toast } from "sonner";

export default function ContactModal({ open, onClose }) {
  const [form, setForm] = useState({ nombre: "", empresa: "", email: "", mensaje: "" });
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.email) return toast.error("Nombre y email son obligatorios");
    setSending(true);
    await api.notifyLead({
      notification_email: "hola@konkabeza.es",
      nombre_negocio: `[GenChat Agencia] Contacto de ${form.nombre}`,
      lead: { notas: `Nombre: ${form.nombre}\nEmpresa: ${form.empresa}\nEmail: ${form.email}\n\nMensaje:\n${form.mensaje}` },
    });
    toast.success("¡Mensaje enviado! Te contactaremos pronto.");
    setSending(false);
    onClose();
    setForm({ nombre: "", empresa: "", email: "", mensaje: "" });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl p-7"
        style={{ background: "#161b27", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <h3 className="font-display text-xl font-bold text-white mb-1">Contactar con ventas</h3>
        <p className="text-sm text-slate-400 mb-6">Te responderemos en menos de 24h.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            placeholder="Tu nombre *"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <input
            placeholder="Empresa"
            value={form.empresa}
            onChange={(e) => setForm({ ...form, empresa: e.target.value })}
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <input
            placeholder="Email *"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <textarea
            placeholder="¿En qué podemos ayudarte?"
            rows={3}
            value={form.mensaje}
            onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50 resize-none"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <button
            type="submit"
            disabled={sending}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", boxShadow: "0 0 20px rgba(249,115,22,0.3)" }}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar mensaje
          </button>
        </form>
      </div>
    </div>
  );
}
