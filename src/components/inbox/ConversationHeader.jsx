import { Link } from "react-router-dom";
import { Bot, User, Loader2, Phone, StickyNote, Mail, MessageSquare, IdCard } from "lucide-react";
import { etiquetaContacto, datosContacto } from "@/lib/inboxContacto";
import { IconoCanal, CANAL_LABEL } from "@/lib/canales";

/** Cabecera de la conversación: contacto, acceso a notas y conmutador IA/humano. */
export default function ConversationHeader({
  conv, showNotas, onToggleNotas, onToggleTakeover, togglingTakeover, onAbrirWhatsApp, abriendoWhatsApp,
}) {
  const contacto = datosContacto(conv);
  // Desde una llamada se puede saltar a WhatsApp si conocemos el número del que llamó.
  const puedeSaltarAWhatsApp = conv.canal === "phone" && !!contacto.telefono;
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card/50 flex-shrink-0">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/40 to-blue-500/40 flex items-center justify-center">
        <User className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate">{etiquetaContacto(conv)}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <IconoCanal canal={conv.canal} />
            {CANAL_LABEL[conv.canal] || conv.canal}
          </span>
          {conv.contacto?.customer_id && (
            <Link
              to={`/contacto/${conv.contacto.customer_id}`}
              title="Ver ficha del contacto y todas sus conversaciones"
              className="flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
            >
              <IdCard className="w-3.5 h-3.5" /> Ficha
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[11px] text-muted-foreground">{conv.proyecto_nombre}</p>
          {/* Datos que solo conocemos tras resolver la identidad omnicanal del que llamó */}
          {contacto.telefono && etiquetaContacto(conv) !== contacto.telefono && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Phone className="w-3 h-3" /> {contacto.telefono}
            </span>
          )}
          {contacto.email && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
              <Mail className="w-3 h-3 shrink-0" /> {contacto.email}
            </span>
          )}
        </div>
      </div>

      {puedeSaltarAWhatsApp && (
        <button
          onClick={() => onAbrirWhatsApp?.(contacto.telefono)}
          disabled={abriendoWhatsApp}
          title={`Continuar por WhatsApp con ${contacto.telefono}`}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors shrink-0 disabled:opacity-50"
        >
          {abriendoWhatsApp
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <MessageSquare className="w-3.5 h-3.5" />}
          WhatsApp
        </button>
      )}

      <button
        onClick={onToggleNotas}
        title="Notas internas"
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors shrink-0 ${
          showNotas
            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
            : "text-muted-foreground border-border hover:text-foreground hover:bg-secondary/60"
        }`}
      >
        <StickyNote className="w-3.5 h-3.5" /> Notas
      </button>

      {/* Conmutador IA / humano — solo WhatsApp */}
      {conv.canal === "whatsapp" && (
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Bot className="w-3.5 h-3.5" /> Agente IA
          </span>
          <button
            onClick={onToggleTakeover}
            disabled={togglingTakeover}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
              conv.human_takeover ? "bg-orange-500" : "bg-primary"
            }`}
            aria-label="Alternar agente IA"
          >
            {togglingTakeover ? (
              <Loader2 className="w-3 h-3 text-white absolute left-1/2 -translate-x-1/2 animate-spin" />
            ) : (
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                conv.human_takeover ? "translate-x-4" : "translate-x-0.5"
              }`} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
