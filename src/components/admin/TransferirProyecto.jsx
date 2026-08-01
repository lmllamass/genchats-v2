import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Loader2, AlertTriangle, Check } from "lucide-react";
import { api } from "@/api/backendApi";
import { toast } from "sonner";

/**
 * Traspaso de propiedad de un chatbot a otra cuenta.
 *
 * Pensado para el flujo real de alta: el chatbot se configura desde la cuenta de admin
 * antes de que el cliente pague, y al pagar se le entrega ya montado y funcionando.
 *
 * Pide escribir el nombre del proyecto para confirmar: una vez transferido, el dueño
 * anterior deja de verlo en su panel y recuperarlo exige saber quién era.
 */
export default function TransferirProyecto({ proyecto, onTransferido }) {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [enviando, setEnviando] = useState(false);

  const nombreOk = confirmacion.trim() === (proyecto.nombre || "").trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const transferir = async () => {
    if (!nombreOk || !emailOk || enviando) return;
    setEnviando(true);
    try {
      const r = await api.adminTransferirProyecto(proyecto.id, email.trim());
      toast.success(
        `Transferido a ${r.nuevo_propietario.email}` +
        (r.plantillas_copiadas ? ` · ${r.plantillas_copiadas} plantilla(s) copiadas` : "")
      );
      setAbierto(false);
      setEmail("");
      setConfirmacion("");
      onTransferido?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 mt-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-white">Transferir propiedad</h3>
            <p className="text-[11px] text-white/40">
              Entrega este chatbot a la cuenta del cliente, ya configurado
            </p>
          </div>
          <Button size="sm" onClick={() => setAbierto(true)}
            className="bg-white/10 text-white/80 border border-white/10 hover:bg-white/15 shrink-0">
            Transferir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 mt-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
          <ArrowRightLeft className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">Transferir «{proyecto.nombre}»</h3>
          <p className="text-[11px] text-white/40">El dueño actual dejará de verlo en su panel</p>
        </div>
      </div>

      <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1.5 text-[11px] text-white/60">
        <p className="flex items-start gap-1.5">
          <Check className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
          Se llevan: conversaciones, leads, reservas, notas y la configuración de WhatsApp, voz y email.
        </p>
        <p className="flex items-start gap-1.5">
          <Check className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
          Las plantillas de respuesta rápida se copian a la cuenta destino.
        </p>
        <p className="flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
          Tú sigues teniendo acceso desde este panel de administración.
        </p>
      </div>

      <div>
        <label className="text-xs text-amber-300/80 mb-1 block">Email de la cuenta destino</label>
        <Input value={email} onChange={e => setEmail(e.target.value)}
          placeholder="cliente@sunegocio.com" className="bg-white/5 border-white/10 text-white/90" />
        <p className="text-[10px] text-white/30 mt-1">
          Esa cuenta debe existir ya en GenChats y tener plan suficiente para otro chatbot.
        </p>
      </div>

      <div>
        <label className="text-xs text-amber-300/80 mb-1 block">
          Escribe «{proyecto.nombre}» para confirmar
        </label>
        <Input value={confirmacion} onChange={e => setConfirmacion(e.target.value)}
          placeholder={proyecto.nombre} className="bg-white/5 border-white/10 text-white/90" />
      </div>

      <div className="flex gap-2">
        <Button onClick={transferir} disabled={!nombreOk || !emailOk || enviando}
          className="bg-amber-600 hover:bg-amber-700 text-white">
          {enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Transfiriendo…</> : "Confirmar traspaso"}
        </Button>
        <Button variant="ghost" onClick={() => { setAbierto(false); setConfirmacion(""); }}
          disabled={enviando} className="text-white/60">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
