import { Globe, Phone, Mail, MessageSquare } from "lucide-react";

/** Etiqueta legible de cada canal. `embed` es el widget web incrustado en la web del cliente. */
export const CANAL_LABEL = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  phone: "Voz",
  email: "Email",
  web: "Web",
  embed: "Web (embed)",
};

/**
 * Icono de canal. WhatsApp y Telegram usan emoji porque lucide no trae sus marcas;
 * el resto usa iconos para que el tamaño case con el texto.
 */
export function IconoCanal({ canal, className = "w-3 h-3" }) {
  switch (canal) {
    case "whatsapp": return <span className="text-[11px] leading-none" title="WhatsApp">💬</span>;
    case "telegram": return <span className="text-[11px] leading-none" title="Telegram">✈️</span>;
    case "phone":    return <Phone className={className} aria-label="Voz" />;
    case "email":    return <Mail className={className} aria-label="Email" />;
    case "web":
    case "embed":    return <Globe className={className} aria-label="Web" />;
    default:         return <MessageSquare className={className} aria-label={canal || "Canal"} />;
  }
}

/** Color de acento por canal, para los badges de la ficha de contacto. */
export const CANAL_COLOR = {
  whatsapp: "bg-green-500/15 text-green-400 border-green-500/25",
  telegram: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  phone:    "bg-violet-500/15 text-violet-400 border-violet-500/25",
  email:    "bg-blue-500/15 text-blue-400 border-blue-500/25",
  web:      "bg-secondary text-muted-foreground border-border",
  embed:    "bg-secondary text-muted-foreground border-border",
};
