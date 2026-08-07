import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/api/backendApi";
import {
  Paperclip, Upload, Trash2, Download, Link2, Loader2, X, Copy, Ban, FileText, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import moment from "moment";
// Sin esto las fechas relativas salían en inglés ("caduca in 7 days"): el panel
// carga el locale en ConversacionesPanel, pero este cajón puede montarse antes.
import "moment/locale/es";
moment.locale("es");

const ORIGEN_ETIQUETA = {
  tenant: { texto: "tuyo", clase: "bg-primary/15 text-primary border-primary/20" },
  portal: { texto: "lo subió el cliente", clase: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  whatsapp: { texto: "WhatsApp", clase: "bg-green-500/15 text-green-400 border-green-500/20" },
  telegram: { texto: "Telegram", clase: "bg-sky-500/15 text-sky-400 border-sky-500/20" },
  email: { texto: "email", clase: "bg-secondary text-muted-foreground border-border" },
  agente: { texto: "el bot", clase: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
};

function tamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function ConversacionArchivos({ conversation, onClose }) {
  const [archivos, setArchivos] = useState([]);
  const [enlaces, setEnlaces] = useState([]);
  const [sinContacto, setSinContacto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [creandoEnlace, setCreandoEnlace] = useState(false);
  const inputRef = useRef(null);

  const convId = conversation?.id;

  const cargar = useCallback(async () => {
    if (!convId) return;
    try {
      const res = await api.listArchivos(convId);
      setArchivos(res?.archivos || []);
      setEnlaces((res?.enlaces || []).filter(e => !e.revocado_en && new Date(e.expira_en) > new Date()));
      setSinContacto(!!res?.sin_contacto);
    } catch (_) {
      toast.error("Error cargando archivos");
    } finally {
      setLoading(false);
    }
  }, [convId]);

  useEffect(() => { setLoading(true); cargar(); }, [cargar]);

  const handleSubir = async (file) => {
    if (!file) return;
    setSubiendo(true);
    try {
      await api.subirArchivo(convId, file);
      toast.success("Archivo subido");
      cargar();
    } catch (err) {
      // El 507 del trigger de cuota llega con el mensaje del plan ya redactado.
      toast.error(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const handleDescargar = async (archivo) => {
    try {
      const { url } = await api.descargarArchivo(convId, archivo.id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error("No se pudo descargar: " + err.message);
    }
  };

  const handleBorrar = async (archivo) => {
    if (!window.confirm(`¿Borrar "${archivo.nombre}"? No se puede deshacer.`)) return;
    try {
      await api.borrarArchivo(convId, archivo.id);
      setArchivos(prev => prev.filter(a => a.id !== archivo.id));
    } catch (err) {
      toast.error("Error: " + err.message);
    }
  };

  const handleCrearEnlace = async (permisos) => {
    setCreandoEnlace(true);
    try {
      const { url } = await api.crearEnlaceArchivos(convId, { permisos });
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Enlace copiado al portapapeles", {
        description: "Caduca en 7 días. Pégaselo al cliente por el chat.",
      });
      cargar();
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setCreandoEnlace(false);
    }
  };

  const handleRevocar = async (enlaceId) => {
    try {
      await api.revocarEnlaceArchivos(convId, enlaceId);
      setEnlaces(prev => prev.filter(e => e.id !== enlaceId));
      toast.success("Enlace revocado");
    } catch (err) {
      toast.error("Error: " + err.message);
    }
  };

  return (
    <div className="w-80 border-l border-border bg-card/30 flex flex-col min-h-0 flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" /> Archivos
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : sinContacto ? (
        <p className="text-[11px] text-muted-foreground text-center px-4 py-8 leading-relaxed">
          Esta conversación todavía no tiene un contacto asociado.<br />
          En cuanto deje su nombre o su teléfono podrás guardarle archivos aquí.
        </p>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {archivos.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-6 leading-relaxed">
                Sin archivos todavía.<br />Sube uno o mándale un enlace para que suba los suyos.
              </p>
            ) : (
              archivos.map(a => {
                const etiqueta = ORIGEN_ETIQUETA[a.origen] || ORIGEN_ETIQUETA.tenant;
                const Icono = a.mime?.startsWith("image/") ? ImageIcon : FileText;
                return (
                  <div key={a.id} className="rounded-lg bg-secondary/40 border border-border p-2.5 group">
                    <div className="flex items-start gap-2">
                      <Icono className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" title={a.nombre}>{a.nombre}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {tamano(a.bytes)} · {moment(a.created_at).format("DD/MM HH:mm")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleDescargar(a)} title="Descargar"
                          className="text-muted-foreground hover:text-foreground">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleBorrar(a)} title="Borrar"
                          className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <span className={`inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded-full border ${etiqueta.clase}`}>
                      {etiqueta.texto}
                    </span>
                  </div>
                );
              })
            )}

            {enlaces.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Enlaces activos
                </p>
                {enlaces.map(e => (
                  <div key={e.id} className="rounded-lg bg-secondary/20 border border-border/60 p-2 mb-1.5 flex items-center gap-2">
                    <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] truncate">
                        {e.permisos?.join(" y ") || "subir"} · caduca {moment(e.expira_en).fromNow()}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {e.usos ? `abierto ${e.usos} ${e.usos === 1 ? "vez" : "veces"}` : "sin abrir todavía"}
                      </p>
                    </div>
                    <button onClick={() => handleRevocar(e.id)} title="Revocar"
                      className="text-muted-foreground hover:text-destructive shrink-0">
                      <Ban className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-2.5 border-t border-border flex-shrink-0 space-y-1.5">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={e => { handleSubir(e.target.files?.[0]); e.target.value = ""; }}
            />
            <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1.5"
              onClick={() => inputRef.current?.click()} disabled={subiendo}>
              {subiendo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              Subir un archivo
            </Button>

            <div className="flex gap-1.5">
              <Button size="sm" className="flex-1 h-7 text-[11px] gap-1"
                onClick={() => handleCrearEnlace(["subir"])} disabled={creandoEnlace}>
                {creandoEnlace ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                Pedirle archivos
              </Button>
              <Button size="sm" variant="secondary" className="flex-1 h-7 text-[11px] gap-1"
                onClick={() => handleCrearEnlace(["subir", "descargar"])} disabled={creandoEnlace}>
                <Link2 className="w-3 h-3" /> Enlace completo
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground text-center leading-tight">
              El enlace se copia al portapapeles y caduca a los 7 días. El cliente entra sin contraseña.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
