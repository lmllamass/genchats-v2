import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Copy, Pencil, Phone, Power } from "lucide-react";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL || "https://api.genchats.app";

export default function RetellProjectSection({ proyecto, onUpdate, saving }) {
  const [editing, setEditing] = useState(!proyecto.retell_agent_id);
  const [form, setForm] = useState({
    retell_agent_id:    proyecto.retell_agent_id    || "",
    retell_phone_number: proyecto.retell_phone_number || "",
    retell_activo:      proyecto.retell_activo       ?? false,
  });

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const wsUrl = `wss://${new URL(API_BASE).host}/api/retell/llm/${proyecto.id}`;

  const handleSave = () => {
    onUpdate(form);
    setEditing(false);
  };

  const handleDeactivate = () => {
    if (confirm("¿Desactivar Voz IA (Retell) para este proyecto?")) {
      onUpdate({ retell_activo: false });
      setForm(prev => ({ ...prev, retell_activo: false }));
    }
  };

  // Connected view
  if (proyecto.retell_agent_id && proyecto.retell_activo && !editing) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Phone className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">Voz IA (Retell) activa</h3>
              {proyecto.retell_phone_number && (
                <p className="text-xs text-violet-300">{proyecto.retell_phone_number}</p>
              )}
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-300 border border-green-500/30">● Activo</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-white/40 text-xs block">Agent ID</span>
            <span className="text-white/80 font-mono text-xs">{proyecto.retell_agent_id}</span>
          </div>
          <div>
            <span className="text-white/40 text-xs block">Custom LLM WebSocket</span>
            <span className="text-white/60 font-mono text-[10px] break-all">{wsUrl}</span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setEditing(true)} className="bg-white/10 text-white/80 border border-white/10 hover:bg-white/15">
            <Pencil className="w-3 h-3 mr-1" /> Editar
          </Button>
          <Button size="sm" onClick={handleDeactivate}
            className="bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30">
            <Power className="w-3 h-3 mr-1" /> Desactivar
          </Button>
        </div>
      </div>
    );
  }

  // Setup / edit view
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 mt-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Phone className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">Voz IA (Retell)</h3>
          <p className="text-[11px] text-white/40">Agente telefónico con IA</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-violet-300/80 mb-1 block">Retell Agent ID</label>
          <Input
            value={form.retell_agent_id}
            onChange={e => setField("retell_agent_id", e.target.value)}
            placeholder="agent_xxxxxxxxxxxxxxxx"
            className="bg-white/5 border-white/10 text-white/90"
          />
        </div>
        <div>
          <label className="text-xs text-violet-300/80 mb-1 block">Número de teléfono</label>
          <Input
            value={form.retell_phone_number}
            onChange={e => setField("retell_phone_number", e.target.value)}
            placeholder="+34919933898"
            className="bg-white/5 border-white/10 text-white/90"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-violet-300/80">Voz IA activa</label>
        <Switch checked={form.retell_activo} onCheckedChange={v => setField("retell_activo", v)} />
      </div>

      {/* Custom LLM WebSocket URL for Retell dashboard */}
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3 space-y-2">
        <p className="text-xs text-violet-300 font-medium">Custom LLM WebSocket URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[11px] text-violet-200 font-mono break-all">{wsUrl}</code>
          <Button type="button" size="sm" variant="ghost" className="text-violet-400 h-6 px-2 shrink-0"
            onClick={() => { navigator.clipboard.writeText(wsUrl); toast.success("📋 Copiado"); }}>
            <Copy className="w-3 h-3" />
          </Button>
        </div>
        <p className="text-[10px] text-white/30">Pega esta URL en el dashboard de Retell → Agente → Custom LLM → WebSocket URL</p>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm"
        className="bg-gradient-to-r from-violet-500 to-purple-600 hover:opacity-90 text-white">
        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
        Guardar
      </Button>
    </div>
  );
}
