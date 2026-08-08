import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/backendApi";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, ChevronDown, ChevronUp, CheckCircle2, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";

const TOOL_META = {
  concertar_cita: {
    label: "Concertar cita",
    desc: "El agente puede registrar citas en Google Calendar cuando el cliente quiere reservar.",
    color: "blue",
    fields: [
      { key: "calendar_id", label: "Google Calendar ID", placeholder: "xxxxx@group.calendar.google.com" },
      { key: "owner_email", label: "Email del propietario (notificación)", placeholder: "negocio@ejemplo.com" },
      { key: "owner_phone", label: "Teléfono del propietario", placeholder: "+34 600 000 000" },
    ],
  },
  capturar_pedido: {
    label: "Capturar pedido",
    desc: "El agente puede registrar pedidos del cliente en un Google Sheet o base de datos.",
    color: "green",
    fields: [
      { key: "sheet_id", label: "Google Sheet ID (o endpoint DB)", placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" },
      { key: "owner_email", label: "Email del propietario (notificación)", placeholder: "negocio@ejemplo.com" },
    ],
  },
  consultar_stock: {
    label: "Consultar stock",
    desc: "El agente puede consultar disponibilidad de stock en tiempo real.",
    color: "amber",
    fields: [
      { key: "api_key", label: "API Key del proveedor", placeholder: "sk-xxxxx" },
      { key: "store_id", label: "Store ID", placeholder: "tu-tienda" },
      { key: "api_url", label: "URL del endpoint (opcional)", placeholder: "https://api.mitienda.com/stock" },
    ],
  },
  custom: {
    label: "Acción personalizada",
    desc: "Acción a medida enviada directamente a tu webhook n8n.",
    color: "violet",
    fields: [
      { key: "description", label: "Descripción de la acción (para el agente)", placeholder: "Ej: Registrar solicitud de presupuesto" },
    ],
  },
};

const COLOR_MAP = {
  blue:   { badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",   toggle: "bg-blue-500"   },
  green:  { badge: "bg-green-500/10 text-green-400 border-green-500/20", toggle: "bg-green-500"  },
  amber:  { badge: "bg-amber-500/10 text-amber-400 border-amber-500/20", toggle: "bg-amber-500"  },
  violet: { badge: "bg-violet-500/10 text-violet-400 border-violet-500/20", toggle: "bg-violet-500" },
};

function ToolRow({ projectId, toolName, existing }) {
  const qc = useQueryClient();
  const meta = TOOL_META[toolName];
  const colors = COLOR_MAP[meta.color];
  const isEnabled = existing?.enabled ?? false;
  const [expanded, setExpanded] = useState(isEnabled);
  const [config, setConfig] = useState(existing?.config || {});
  const [calCheck, setCalCheck] = useState(null); // { ok, error, summary, timeZone }
  const [checking, setChecking] = useState(false);

  const isCalendar = toolName === "concertar_cita";

  const { data: saEmail } = useQuery({
    queryKey: ["google-calendar-sa-email"],
    queryFn: () => api.adminGetGoogleCalendarServiceAccountEmail().then(r => r.email),
    enabled: isCalendar && expanded,
    staleTime: Infinity,
  });

  const upsertMut = useMutation({
    mutationFn: (data) => api.adminUpsertProjectTool(projectId, { tool_name: toolName, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tools", projectId] });
      toast.success(`${meta.label} actualizado`);
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const handleToggle = () => {
    const next = !isEnabled;
    upsertMut.mutate({ enabled: next, config });
    if (next) setExpanded(true);
  };

  const handleCheckCalendar = async () => {
    setChecking(true);
    setCalCheck(null);
    try {
      const result = await api.adminCheckGoogleCalendar(config.calendar_id);
      setCalCheck(result);
    } catch (e) {
      setCalCheck({ ok: false, error: e.message });
    } finally {
      setChecking(false);
    }
  };

  const handleSaveConfig = async () => {
    if (isCalendar && config.calendar_id) {
      await handleCheckCalendar();
    }
    upsertMut.mutate({ enabled: isEnabled, config });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={handleToggle}
          disabled={upsertMut.isPending}
          className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${isEnabled ? colors.toggle : 'bg-white/20'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-5' : ''}`} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{meta.label}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${colors.badge}`}>{toolName}</span>
          </div>
          <p className="text-xs text-white/40 mt-0.5">{meta.desc}</p>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-white/40 hover:text-white/70 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Config fields */}
      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-3 bg-white/[0.02]">
          {isCalendar && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-1">
              <p className="text-[11px] text-blue-300">
                Para que el agente pueda crear citas de verdad, comparte el calendario de Google con esta cuenta de servicio (permiso "Realizar cambios en eventos"):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] text-blue-200 font-mono break-all">{saEmail || "cargando…"}</code>
                {saEmail && (
                  <button type="button" onClick={() => { navigator.clipboard.writeText(saEmail); toast.success("Copiado"); }} className="text-blue-400 hover:text-blue-300 shrink-0">
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
          {meta.fields.map(f => (
            <div key={f.key}>
              <label className="text-[11px] text-white/40 font-medium block mb-1">{f.label}</label>
              <input
                value={config[f.key] || ""}
                onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
              />
            </div>
          ))}
          {isCalendar && calCheck && (
            <div className={`flex items-start gap-2 text-xs rounded-lg p-2.5 ${calCheck.ok ? "bg-green-500/10 text-green-300 border border-green-500/20" : "bg-red-500/10 text-red-300 border border-red-500/20"}`}>
              {calCheck.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{calCheck.ok ? `Conectado a "${calCheck.summary}" (${calCheck.timeZone}).` : calCheck.error}</span>
            </div>
          )}
          <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSaveConfig}
            disabled={upsertMut.isPending || checking}
            className="bg-white/10 hover:bg-white/20 text-white border-0"
          >
            {(upsertMut.isPending || checking) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Guardar configuración"}
          </Button>
          {isCalendar && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCheckCalendar}
              disabled={checking || !config.calendar_id}
              className="bg-transparent border-white/10 text-white/70 hover:bg-white/5"
            >
              {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Comprobar conexión"}
            </Button>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Webhook de automatizaciones de ESTE proyecto.
 *
 * Vacío = usa el global de la plataforma, que es como funcionaba todo hasta
 * ahora. Rellenarlo permite dar a un cliente su propio n8n: su flujo, su
 * almacenamiento (Dropbox, Drive, lo que sea) y, sobre todo, que un fallo suyo
 * no arrastre a los demás.
 *
 * Está en admin y no en el panel del tenant a propósito: en cada llamada viaja
 * la ycloud_api_key del proyecto y su configuración.
 */
function WebhookDelProyecto({ proyecto }) {
  const [url, setUrl] = useState(proyecto?.n8n_webhook_url || "");
  const [guardando, setGuardando] = useState(false);
  const sucio = (proyecto?.n8n_webhook_url || "") !== url;

  const guardar = async () => {
    const limpia = url.trim();
    if (limpia && !/^https?:\/\//i.test(limpia)) {
      return toast.error("Tiene que ser una URL completa (https://…)");
    }
    setGuardando(true);
    try {
      await api.adminUpdateProyecto(proyecto.id, { n8n_webhook_url: limpia || null });
      toast.success(limpia ? "Webhook propio guardado" : "Vuelve a usar el global");
    } catch (err) {
      toast.error(err?.message || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3 mb-5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Webhook de n8n de este proyecto
        </span>
        {!proyecto?.n8n_webhook_url && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">
            usando el global
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://n8n-del-cliente/webhook/acciones — vacío para usar el global"
          className="flex-1 h-8 px-2.5 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-orange-400/50"
        />
        <Button size="sm" className="h-8 text-xs" onClick={guardar} disabled={guardando || !sucio}>
          {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar"}
        </Button>
      </div>
      <p className="text-[10px] text-white/35 leading-snug">
        Aquí es donde se decide a dónde van los datos del cliente: qué flujo los procesa y dónde se
        guardan. Cambiando esta URL, un cliente puede usar su propio n8n sin que nadie toque el
        compartido — y un fallo suyo deja de afectar al resto.
      </p>
    </div>
  );
}


/**
 * Webhook que avisa cuando el cliente final termina de subir sus documentos.
 *
 * Vive en admin por lo mismo que el otro: es una URL a la que se manda quién ha
 * subido qué. Y va aquí, junto al de acciones, para que se vean de un vistazo
 * los dos sitios a los que este proyecto envía datos.
 */
function WebhookAcuseArchivos({ proyecto }) {
  const [url, setUrl] = useState("");
  const [cargado, setCargado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useQuery({
    queryKey: ["admin-tools-archivos", proyecto?.id],
    queryFn: async () => {
      const filas = await api.adminGetProjectTools(proyecto.id);
      const fila = (Array.isArray(filas) ? filas : filas?.tools || [])
        .find(f => f.tool_name === "archivos");
      setUrl(fila?.config?.webhook_confirmacion || "");
      setCargado(true);
      return fila || null;
    },
    enabled: !!proyecto?.id,
  });

  const guardar = async () => {
    const limpia = url.trim();
    if (limpia && !/^https?:\/\//i.test(limpia)) {
      return toast.error("Tiene que ser una URL completa (https://…)");
    }
    setGuardando(true);
    try {
      const filas = await api.adminGetProjectTools(proyecto.id);
      const fila = (Array.isArray(filas) ? filas : filas?.tools || [])
        .find(f => f.tool_name === "archivos");
      await api.adminUpsertProjectTool(proyecto.id, {
        tool_name: "archivos",
        enabled: true,
        config: { ...(fila?.config || {}), webhook_confirmacion: limpia },
      });
      toast.success(limpia ? "Acuse configurado" : "Acuse desactivado");
    } catch (err) {
      toast.error(err?.message || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3 mb-5 space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
        Aviso cuando llega documentación
      </span>
      <div className="flex gap-2">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={!cargado}
          placeholder="https://n8n/webhook/documentacion-recibida — vacío para no avisar"
          className="flex-1 h-8 px-2.5 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-orange-400/50 disabled:opacity-40"
        />
        <Button size="sm" className="h-8 text-xs" onClick={guardar} disabled={guardando || !cargado}>
          {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar"}
        </Button>
      </div>
      <p className="text-[10px] text-white/35 leading-snug">
        Cuando el cliente final termina de subir sus documentos, se llama a esta URL con quién es y
        dónde han quedado. Sin ella los archivos se guardan igual, pero nadie se entera de que han
        llegado.
      </p>
    </div>
  );
}


export default function ToolsProjectSection({ proyecto }) {
  const { data: tools = [], isLoading } = useQuery({
    queryKey: ["project-tools", proyecto.id],
    queryFn: () => api.adminGetProjectTools(proyecto.id),
  });

  const toolMap = Object.fromEntries(tools.map(t => [t.tool_name, t]));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mt-6">
      <div className="flex items-center gap-2 mb-5">
        <Zap className="w-4 h-4 text-orange-400" />
        <h3 className="font-display font-semibold text-white">Herramientas / Acciones</h3>
      </div>
      <p className="text-xs text-white/40 mb-5">
        Activa las acciones que el agente puede ejecutar. «Concertar cita» y «Capturar pedido» son
        nativas y no necesitan n8n. El resto pasan por el webhook de abajo.
      </p>

      <WebhookDelProyecto proyecto={proyecto} />
      <WebhookAcuseArchivos proyecto={proyecto} />

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-white/40" />
        </div>
      ) : (
        <div className="space-y-3">
          {Object.keys(TOOL_META).map(toolName => (
            <ToolRow
              key={toolName}
              projectId={proyecto.id}
              toolName={toolName}
              existing={toolMap[toolName] || null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
