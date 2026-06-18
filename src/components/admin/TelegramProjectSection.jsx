import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Copy, Globe, Eye, EyeOff, Send } from "lucide-react";
import { api } from "@/api/backendApi";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL || "https://api.genchats.app";

export default function TelegramProjectSection({ proyecto, onUpdate, saving }) {
  const [editing, setEditing] = useState(!proyecto.telegram_token);
  const [showToken, setShowToken] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({
    telegram_token: proyecto.telegram_token || "",
    telegram_username: proyecto.telegram_username || "",
    telegram_activo: proyecto.telegram_activo ?? false,
  });

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const webhookUrl = `${API_BASE}/api/telegram/webhook/${proyecto.id}`;

  const handleSave = () => {
    onUpdate(form);
    setEditing(false);
  };

  const registerWebhook = async () => {
    if (!form.telegram_token && !proyecto.telegram_token) {
      toast.error("Guarda el token de bot antes de registrar el webhook");
      return;
    }
    setRegistering(true);
    try {
      const res = await api.adminTelegramRegisterWebhook(proyecto.id);
      if (res.ok) {
        toast.success("✅ Webhook de Telegram registrado correctamente");
      } else {
        toast.error(res.error || "Error al registrar webhook");
      }
    } catch (e) {
      toast.error("Error: " + e.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleDeactivate = () => {
    if (confirm("¿Desactivar Telegram para este proyecto?")) {
      onUpdate({ telegram_activo: false });
      setForm(prev => ({ ...prev, telegram_activo: false }));
    }
  };

  // Connected view
  if (proyecto.telegram_token && proyecto.telegram_activo && !editing) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <span className="text-lg">✈️</span>
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">Telegram Conectado</h3>
              {proyecto.telegram_username && (
                <a
                  href={`https://t.me/${proyecto.telegram_username.replace("@", "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-300 hover:underline"
                >
                  @{proyecto.telegram_username.replace("@", "")}
                </a>
              )}
              <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-300 border border-green-500/30">● Activo</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setEditing(true)} className="bg-white/10 text-white/80 border border-white/10 hover:bg-white/15">
            Editar token
          </Button>
          <Button size="sm" onClick={registerWebhook} disabled={registering}
            className="bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30">
            {registering ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Globe className="w-3 h-3 mr-1" />}
            Re-registrar webhook
          </Button>
          <Button size="sm" onClick={handleDeactivate}
            className="bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30">
            Desactivar
          </Button>
        </div>
      </div>
    );
  }

  // Setup / edit view
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 mt-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <span className="text-lg">✈️</span>
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">Conexión Telegram</h3>
          <p className="text-[11px] text-white/40">Bot creado en @BotFather</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-blue-300/80 mb-1 block">Bot Token (de @BotFather)</label>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              value={form.telegram_token}
              onChange={e => setField("telegram_token", e.target.value)}
              placeholder="123456:ABC-DEF..."
              className="bg-white/5 border-white/10 text-white/90 pr-10"
            />
            <button type="button" onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-blue-300/80 mb-1 block">Username del bot (sin @)</label>
          <Input
            value={form.telegram_username}
            onChange={e => setField("telegram_username", e.target.value)}
            placeholder="MiChatbotBot"
            className="bg-white/5 border-white/10 text-white/90"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-blue-300/80">Telegram activo</label>
        <Switch checked={form.telegram_activo} onCheckedChange={v => setField("telegram_activo", v)} />
      </div>

      {/* Webhook info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
        <p className="text-xs text-blue-300 font-medium">URL del Webhook</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[11px] text-blue-200 font-mono break-all">{webhookUrl}</code>
          <Button type="button" size="sm" variant="ghost" className="text-blue-400 h-6 px-2 shrink-0"
            onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("📋 Copiado"); }}>
            <Copy className="w-3 h-3" />
          </Button>
        </div>
        <p className="text-[10px] text-white/30">Registra este webhook en Telegram con el botón de abajo, o manualmente:</p>
        <code className="block text-[10px] text-white/40 font-mono break-all">
          curl -F "url={webhookUrl}" https://api.telegram.org/bot&#123;TOKEN&#125;/setWebhook
        </code>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleSave} disabled={saving} size="sm"
          className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90 text-white">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Guardar
        </Button>
        <Button size="sm" onClick={registerWebhook} disabled={registering}
          className="bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30">
          {registering ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Globe className="w-4 h-4 mr-1" />}
          Registrar webhook automáticamente
        </Button>
      </div>

      {/* How-to guide */}
      <details className="text-xs text-white/40">
        <summary className="cursor-pointer hover:text-white/60 font-medium">📖 Cómo crear un bot en Telegram</summary>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li>Abre Telegram y busca <strong className="text-white/60">@BotFather</strong></li>
          <li>Envía <code className="text-blue-300">/newbot</code> y sigue las instrucciones</li>
          <li>Copia el token que te da (formato <code className="text-blue-300">123456:ABC...</code>)</li>
          <li>Pégalo en el campo "Bot Token" de arriba</li>
          <li>Guarda y pulsa "Registrar webhook automáticamente"</li>
          <li>¡Tu bot ya responde con Claude!</li>
        </ol>
      </details>
    </div>
  );
}
