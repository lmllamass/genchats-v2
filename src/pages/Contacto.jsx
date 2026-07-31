import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, User, Phone, Mail, Building2, AlertCircle, Layers } from "lucide-react";
import { api } from "@/api/backendApi";
import { IconoCanal, CANAL_LABEL, CANAL_COLOR } from "@/lib/canales";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

const ORDEN_CANALES = ["whatsapp", "phone", "telegram", "email", "web", "embed"];
const TODO = "__todo__";

/**
 * Histórico único del contacto: todos los canales en una sola línea temporal.
 *
 * Es la vista donde el icono de canal hace trabajo de verdad — en las pestañas por canal
 * todos los mensajes son del mismo, así que el icono ahí es redundante. Aquí es lo único
 * que te dice por dónde entró cada mensaje ("llamó → le escribimos por WhatsApp → …").
 */
function LineaTemporal({ canales }) {
  const todos = Object.values(canales)
    .flat()
    .flatMap(c => c.mensajes.map(m => ({ ...m, channel: m.channel || c.channel })))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (!todos.length) {
    return <p className="text-xs text-muted-foreground text-center py-8">Sin mensajes registrados</p>;
  }

  let diaAnterior = null;
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2.5">
      {todos.map(m => {
        const dia = moment(m.created_at).format("YYYY-MM-DD");
        const nuevoDia = dia !== diaAnterior;
        diaAnterior = dia;
        return (
          <div key={m.id}>
            {nuevoDia && (
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  {moment(m.created_at).format("dddd, D [de] MMMM YYYY")}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <div className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-secondary/60 text-foreground rounded-tl-sm"
                  : "bg-primary/20 text-foreground border border-primary/30 rounded-tr-sm"
              }`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-muted-foreground/60">
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${CANAL_COLOR[m.channel] || ""}`}>
                    <IconoCanal canal={m.channel} className="w-2.5 h-2.5" />
                    {CANAL_LABEL[m.channel] || m.channel}
                  </span>
                  <span>{moment(m.created_at).format("HH:mm")}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Hilo({ conv }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/60 bg-secondary/30">
        <span className="text-[11px] text-muted-foreground">
          {moment(conv.first_message_at).format("D MMM YYYY, HH:mm")}
          {" · "}{conv.mensajes.length} mensaje{conv.mensajes.length === 1 ? "" : "s"}
        </span>
        {conv.human_takeover && (
          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">
            humano
          </span>
        )}
      </div>
      <div className="p-4 space-y-2.5 max-h-[420px] overflow-y-auto">
        {conv.mensajes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Sin mensajes registrados</p>
        ) : conv.mensajes.map(m => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "bg-secondary/60 text-foreground rounded-tl-sm"
                : "bg-primary/20 text-foreground border border-primary/30 rounded-tr-sm"
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-muted-foreground/60">
                <IconoCanal canal={m.channel} className="w-2.5 h-2.5" />
                <span>{moment(m.created_at).format("D MMM HH:mm")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Contacto() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [canalActivo, setCanalActivo] = useState(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    api.getCustomer360(id)
      .then(d => {
        if (!vigente) return;
        setData(d);
        // Arranca en "Todo": es la vista que da la foto completa del contacto de un vistazo.
        setCanalActivo(TODO);
      })
      .catch(err => { if (vigente) setError(err.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [id]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 py-12 max-w-2xl mx-auto text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <p className="text-sm text-muted-foreground">{error || "Contacto no encontrado"}</p>
        <Link to="/conversaciones" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Volver al inbox
        </Link>
      </div>
    );
  }

  const { customer, canales, proyecto_nombre } = data;
  const canalesConHilos = ORDEN_CANALES.filter(c => canales?.[c]?.length);
  const totalMensajes = Object.values(canales || {}).flat().reduce((n, c) => n + c.mensajes.length, 0);
  const nombre = customer.display_name || customer.primary_phone || customer.primary_email || "Contacto";

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto">
      <Link to="/conversaciones" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Inbox
      </Link>

      {/* Ficha */}
      <div className="rounded-2xl border border-border bg-card p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {nombre[0]?.toUpperCase() || <User className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight truncate">{nombre}</h1>
            <p className="text-xs text-muted-foreground">{proyecto_nombre}</p>
            <div className="flex items-center gap-4 flex-wrap mt-3 text-sm">
              {customer.primary_phone && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" /> {customer.primary_phone}
                </span>
              )}
              {customer.primary_email && (
                <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                  <Mail className="w-3.5 h-3.5 shrink-0" /> {customer.primary_email}
                </span>
              )}
              {customer.company && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5" /> {customer.company}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-3">
              Primer contacto {moment(customer.first_seen_at).fromNow()}
              {" · "}último {moment(customer.last_seen_at).fromNow()}
            </p>
          </div>
        </div>
      </div>

      {canalesConHilos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          Este contacto todavía no tiene conversaciones registradas en el histórico omnicanal.
        </p>
      ) : (
        <>
          {/* "Todo" = línea temporal única; el resto de pestañas mantienen cada canal aparte */}
          <div className="flex gap-2 flex-wrap mb-5">
            <button
              onClick={() => setCanalActivo(TODO)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                canalActivo === TODO
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Todo
              <span className="opacity-60">({totalMensajes})</span>
            </button>
            {canalesConHilos.map(c => (
              <button
                key={c}
                onClick={() => setCanalActivo(c)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  canalActivo === c ? CANAL_COLOR[c] : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <IconoCanal canal={c} className="w-3.5 h-3.5" />
                {CANAL_LABEL[c] || c}
                <span className="opacity-60">({canales[c].length})</span>
              </button>
            ))}
          </div>

          {canalActivo === TODO ? (
            <LineaTemporal canales={canales} />
          ) : (
            <div className="space-y-4">
              {(canales[canalActivo] || []).map(conv => <Hilo key={conv.id} conv={conv} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
