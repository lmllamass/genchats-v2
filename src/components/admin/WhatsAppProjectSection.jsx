import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Loader2, Save, Copy, Pencil, Power, Send, Globe, Eye, EyeOff } from "lucide-react";
import { api } from "@/api/backendApi";
import { toast } from "sonner";
import WhatsAppManualGuide from "./WhatsAppManualGuide";
import TestMessageModal from "./TestMessageModal";

const API_PUBLIC_URL = import.meta.env.VITE_API_URL || "https://api-v2.genchats.app";
const WEBHOOK_URL = `${API_PUBLIC_URL}/api/ycloud/webhook`;

function buildPromptFromConfig(proyecto) {
  const c = proyecto.chatbot_config || {};
  return `Eres el asistente virtual de "${c.nombre_negocio || proyecto.nombre}".
Responde de forma amable, profesional y concisa en español.
${c.descripcion ? `Descripción del negocio: ${c.descripcion}` : ""}
${c.knowledge_base ? `Base de conocimiento:\n${c.knowledge_base}` : ""}
${c.telefono ? `Teléfono de contacto: ${c.telefono}` : ""}
${c.email ? `Email de contacto: ${c.email}` : ""}
${c.direccion ? `Dirección: ${c.direccion}` : ""}
Si no tienes la información, sugiere contactar directamente con el negocio.`;
}

export default function WhatsAppProjectSection({ proyecto, onUpdate, saving, configPlataforma }) {
  const [editing, setEditing] = useState(!proyecto.whatsapp_activo);
  const [showTestModal, setShowTestModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [form, setForm] = useState({
    ycloud_account_email: proyecto.ycloud_account_email || "",
    ycloud_api_key: proyecto.ycloud_api_key || "",
    ycloud_phone_number: proyecto.ycloud_phone_number || "",
    ycloud_waba_id: proyecto.ycloud_waba_id || "",
    ycloud_phone_number_id: proyecto.ycloud_phone_number_id || "",
    whatsapp_activo: proyecto.whatsapp_activo || false,
    modo_atencion: proyecto.modo_atencion || "bot",
    limite_mensajes: proyecto.limite_mensajes || configPlataforma?.limite_mensajes_global || 200,
    system_prompt: proyecto.system_prompt || "",
  });

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = () => {
    onUpdate(form);
    setEditing(false);
  };

  const regeneratePrompt = () => {
    setField("system_prompt", buildPromptFromConfig(proyecto));
    toast.success("Prompt regenerado");
  };

  const registerWebhook = async () => {
    setRegistering(true);
    try {
      const payload = proyecto.ycloud_api_key ? { proyecto_id: proyecto.id } : {};
      const res = await api.registrarWebhook(payload);
      if (res.ok) {
        toast.success(res.status === "ya_existia" ? "Webhook ya registrado en esta cuenta" : "✅ Webhook registrado correctamente");
      } else {
        toast.error(res.error || "Error");
      }
    } catch (e) { toast.error(e.message); }
    setRegistering(false);
  };

  const handleDeactivate = () => {
    if (confirm("¿Seguro que quieres desactivar WhatsApp para este proyecto?")) {
      onUpdate({ whatsapp_activo: false });
    }
  };

  const msgPct = proyecto.limite_mensajes ? Math.min((proyecto.mensajes_mes || 0) / proyecto.limite_mensajes * 100, 100) : 0;

  // Connected view (read-only)
  if (proyecto.whatsapp_activo && !editing) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
              <span className="text-lg">📱</span>
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">WhatsApp Conectado</h3>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-300 border border-green-500/30">● Activo</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-white/40 text-xs">Número</span><div className="text-white/90 font-mono">{proyecto.ycloud_phone_number}</div></div>
          <div><span className="text-white/40 text-xs">WABA ID</span><div className="text-white/90 font-mono text-xs">{proyecto.ycloud_waba_id}</div></div>
          <div><span className="text-white/40 text-xs">Phone ID</span><div className="text-white/90 font-mono text-xs">{proyecto.ycloud_phone_number_id}</div></div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/40">Mensajes mes</span>
            <span className="text-white/70">{proyecto.mensajes_mes || 0} / {proyecto.limite_mensajes || 200}</span>
          </div>
          <Progress value={msgPct} className="h-2" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Modo:</span>
          {["bot", "coexistencia", "humano"].map(m => (
            <button key={m} onClick={() => onUpdate({ modo_atencion: m })}
              className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${form.modo_atencion === m || proyecto.modo_atencion === m ? "bg-orange-500/20 text-orange-300 border-orange-500/30" : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"}`}>
              {m === "bot" ? "🤖 Bot" : m === "coexistencia" ? "👥 Coex" : "🧑 Humano"}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setEditing(true)} className="bg-white/10 text-white/80 border border-white/10 hover:bg-white/15">
            <Pencil className="w-3 h-3 mr-1" /> Editar datos
          </Button>
          <Button size="sm" onClick={() => setShowTestModal(true)} className="bg-green-600/20 text-green-300 border border-green-500/30 hover:bg-green-600/30">
            <Send className="w-3 h-3 mr-1" /> Mensaje de prueba
          </Button>
          <Button size="sm" onClick={handleDeactivate} className="bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30">
            <Power className="w-3 h-3 mr-1" /> Desactivar
          </Button>
        </div>

        {showTestModal && <TestMessageModal proyectoId={proyecto.id} onClose={() => setShowTestModal(false)} />}
      </div>
    );
  }

  // Edit / setup view
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center">
          <span className="text-lg">📱</span>
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">Conexión WhatsApp</h3>
          <p className="text-[11px] text-white/40">Alta manual del número</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-orange-300/80 mb-1 block">Email cuenta YCloud</label>
          <Input value={form.ycloud_account_email} onChange={e => setField("ycloud_account_email", e.target.value)}
            placeholder="ej: cliente@empresa.com" className="bg-white/5 border-white/10 text-white/90" />
        </div>
        <div>
          <label className="text-xs text-orange-300/80 mb-1 block">API Key YCloud</label>
          <div className="relative">
            <Input type={showApiKey ? "text" : "password"} value={form.ycloud_api_key} onChange={e => setField("ycloud_api_key", e.target.value)}
              placeholder="Pegar API key de YCloud" className="bg-white/5 border-white/10 text-white/90 pr-10" />
            <button type="button" onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-orange-300/80 mb-1 block">Número WhatsApp (+34XXXXXXXXX)</label>
          <Input value={form.ycloud_phone_number} onChange={e => setField("ycloud_phone_number", e.target.value)}
            placeholder="+34612345678" className="bg-white/5 border-white/10 text-white/90" />
        </div>
        <div>
          <label className="text-xs text-orange-300/80 mb-1 block">WABA ID</label>
          <Input value={form.ycloud_waba_id} onChange={e => setField("ycloud_waba_id", e.target.value)}
            placeholder="Copia de YCloud" className="bg-white/5 border-white/10 text-white/90" />
        </div>
        <div>
          <label className="text-xs text-orange-300/80 mb-1 block">Phone Number ID</label>
          <Input value={form.ycloud_phone_number_id} onChange={e => setField("ycloud_phone_number_id", e.target.value)}
            placeholder="Copia de YCloud" className="bg-white/5 border-white/10 text-white/90" />
        </div>
        <div>
          <label className="text-xs text-orange-300/80 mb-1 block">Límite mensajes/mes</label>
          <Input type="number" value={form.limite_mensajes} onChange={e => setField("limite_mensajes", Number(e.target.value))}
            className="bg-white/5 border-white/10 text-white/90 w-32" min={0} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-orange-300/80">WhatsApp activo</label>
        <Switch checked={form.whatsapp_activo} onCheckedChange={v => setField("whatsapp_activo", v)} />
      </div>

      <div>
        <label className="text-xs text-orange-300/80 mb-1 block">Modo de atención</label>
        <div className="flex gap-2">
          {["bot", "coexistencia", "humano"].map(m => (
            <button key={m} onClick={() => setField("modo_atencion", m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.modo_atencion === m ? "bg-orange-500/20 text-orange-300 border-orange-500/30" : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"}`}>
              {m === "bot" ? "🤖 Bot" : m === "coexistencia" ? "👥 Coexistencia" : "🧑 Humano"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-orange-300/80">System Prompt</label>
          <Button type="button" size="sm" variant="ghost" onClick={regeneratePrompt} className="text-orange-400 hover:text-orange-300 text-xs h-6">
            🔄 Regenerar
          </Button>
        </div>
        <Textarea value={form.system_prompt} onChange={e => setField("system_prompt", e.target.value)}
          placeholder="Prompt del asistente..." className="bg-white/5 border-white/10 text-white/90 min-h-[100px] text-xs" />
      </div>

      {/* Webhook info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
        <p className="text-xs text-blue-300 font-medium">Webhooks</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40 shrink-0">Webhook URL:</span>
          <code className="flex-1 text-[11px] text-blue-300 font-mono truncate">{WEBHOOK_URL}</code>
          <Button type="button" size="sm" variant="ghost" className="text-blue-400 h-6 px-2"
            onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success("📋 Copiado"); }}>
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleSave} disabled={saving} size="sm"
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 text-white">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Guardar cambios
        </Button>
        <Button size="sm" onClick={registerWebhook} disabled={registering}
          className="bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30">
          {registering ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Globe className="w-4 h-4 mr-1" />}
          Registrar webhook
        </Button>
        <Button size="sm" onClick={() => setShowTestModal(true)}
          className="bg-green-600/20 text-green-300 border border-green-500/30 hover:bg-green-600/30">
          <Send className="w-3 h-3 mr-1" /> Mensaje de prueba
        </Button>
      </div>

      <WhatsAppManualGuide />
      {showTestModal && <TestMessageModal proyectoId={proyecto.id} onClose={() => setShowTestModal(false)} />}
    </div>
  );
}
