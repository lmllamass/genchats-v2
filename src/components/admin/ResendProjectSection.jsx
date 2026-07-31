import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Pencil, Mail, Power, AlertTriangle } from "lucide-react";

/**
 * Email saliente del proyecto (Resend).
 *
 * El remitente debe ser un dominio del propio negocio y estar verificado en Resend, o los
 * correos irán a spam. Por eso `email_activo` es un interruptor aparte: se marca solo
 * cuando la verificación DNS está hecha.
 */
export default function ResendProjectSection({ proyecto, onUpdate, saving }) {
  const [editing, setEditing] = useState(!proyecto.email_remitente);
  const [form, setForm] = useState({
    resend_api_key:         proyecto.resend_api_key         || "",
    email_remitente:        proyecto.email_remitente        || "",
    email_remitente_nombre: proyecto.email_remitente_nombre || "",
    email_activo:           proyecto.email_activo           ?? false,
  });

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const dominio = (form.email_remitente.split("@")[1] || "").trim();

  const handleSave = () => {
    onUpdate({ ...form, resend_api_key: form.resend_api_key.trim() || null });
    setEditing(false);
  };

  const handleDeactivate = () => {
    if (confirm("¿Desactivar el email saliente de este proyecto?")) {
      onUpdate({ email_activo: false });
      setForm(prev => ({ ...prev, email_activo: false }));
    }
  };

  // Vista conectada
  if (proyecto.email_remitente && proyecto.email_activo && !editing) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 mt-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-500/20 flex items-center justify-center">
            <Mail className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-white">Email saliente activo</h3>
            <p className="text-xs text-sky-300">
              {proyecto.email_remitente_nombre
                ? `${proyecto.email_remitente_nombre} <${proyecto.email_remitente}>`
                : proyecto.email_remitente}
            </p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-300 border border-green-500/30">● Activo</span>
          </div>
        </div>

        <div className="text-sm">
          <span className="text-white/40 text-xs block">Cuenta de Resend</span>
          <span className="text-white/80 text-xs">
            {proyecto.resend_api_key ? "Propia del cliente" : "De plataforma (dominio verificado en nuestra cuenta)"}
          </span>
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

  // Vista de alta / edición
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 mt-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-sky-500/20 flex items-center justify-center">
          <Mail className="w-4 h-4 text-sky-400" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">Email saliente (Resend)</h3>
          <p className="text-[11px] text-white/40">Para escribir al cliente desde el dominio del negocio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-sky-300/80 mb-1 block">Dirección remitente</label>
          <Input
            value={form.email_remitente}
            onChange={e => setField("email_remitente", e.target.value)}
            placeholder="reservas@negocio.com"
            className="bg-white/5 border-white/10 text-white/90"
          />
        </div>
        <div>
          <label className="text-xs text-sky-300/80 mb-1 block">Nombre visible</label>
          <Input
            value={form.email_remitente_nombre}
            onChange={e => setField("email_remitente_nombre", e.target.value)}
            placeholder="Autoescuela Ejemplo"
            className="bg-white/5 border-white/10 text-white/90"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-sky-300/80 mb-1 block">
          API Key de Resend del cliente <span className="text-white/30">(opcional)</span>
        </label>
        <Input
          value={form.resend_api_key}
          onChange={e => setField("resend_api_key", e.target.value)}
          placeholder="re_xxxxxxxxxxxxxxxx — vacío = usar la cuenta de plataforma"
          className="bg-white/5 border-white/10 text-white/90 font-mono text-xs"
        />
        <p className="text-[10px] text-white/30 mt-1">
          Si el cliente tiene su propia cuenta de Resend, pega aquí su key. Si lo dejas vacío se
          usa la cuenta de plataforma, y entonces el dominio hay que verificarlo en ella.
        </p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-1.5">
        <p className="text-xs text-amber-300 font-medium flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> El dominio debe estar verificado antes de activar
        </p>
        <p className="text-[11px] text-white/50 leading-relaxed">
          En Resend → Domains → Add Domain{dominio ? ` (${dominio})` : ""}, y el cliente debe añadir
          los registros DNS (SPF/DKIM) que le indique Resend. Sin eso, Resend rechaza el envío o los
          correos acaban en spam.
        </p>
        {dominio && (
          <a href="https://resend.com/domains" target="_blank" rel="noreferrer"
            className="text-[11px] text-sky-300 hover:underline inline-block">
            Abrir Resend → Domains →
          </a>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-sky-300/80">Email activo (dominio ya verificado)</label>
        <Switch
          checked={form.email_activo}
          disabled={!form.email_remitente.trim()}
          onCheckedChange={v => setField("email_activo", v)}
        />
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm"
        className="bg-gradient-to-r from-sky-500 to-blue-600 hover:opacity-90 text-white">
        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
        Guardar
      </Button>
    </div>
  );
}
