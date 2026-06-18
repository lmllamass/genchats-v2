import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, Bot, Share2, Copy, MoreHorizontal, Trash2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import StatusBadge from "./StatusBadge";
import ProyectoStats from "./ProyectoStats.jsx";
import { TEMPLATES, COLOR_SCHEMES } from "@/lib/templates";
import { format } from "date-fns";

export default function ProyectoCard({ proyecto, onDuplicate, onDelete, index = 0 }) {
  const tpl = TEMPLATES[proyecto.plantilla_elegida] || TEMPLATES.moderna;
  const cs = COLOR_SCHEMES[proyecto.esquema_color] || COLOR_SCHEMES.azul_profesional;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group relative rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden hover:border-primary/40 transition-all"
    >
      <div className="h-28 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${cs.swatch[0]}, ${cs.swatch[1]})` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute top-3 left-3"><StatusBadge estado={proyecto.estado} /></div>
        <div className="absolute top-3 right-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-lg bg-black/30 hover:bg-black/50 backdrop-blur flex items-center justify-center text-white">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDuplicate(proyecto)}><Copy className="w-4 h-4 mr-2" /> Duplicar</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(proyecto)}>
                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="absolute bottom-3 left-3 text-white/90 text-2xl">{tpl.emoji}</div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-semibold text-lg leading-tight truncate">{proyecto.nombre}</h3>
          {proyecto.whatsapp_activo && (
            <span className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium">
              <MessageCircle className="w-3 h-3" /> WhatsApp
            </span>
          )}
        </div>
        <a href={proyecto.url_origen} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground truncate">
          <ExternalLink className="w-3 h-3 shrink-0" /><span className="truncate">{proyecto.url_origen}</span>
        </a>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded-md bg-secondary">{tpl.name}</span>
          <span className="px-2 py-1 rounded-md bg-secondary">{cs.name}</span>
        </div>
        <div className="mt-3">
          <ProyectoStats proyectoId={proyecto.id} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {proyecto.created_date ? format(new Date(proyecto.created_date), "d MMM yyyy") : ""}
          </span>
          <div className="flex gap-1.5">
            <Button asChild size="sm" variant="ghost" className="h-8 px-2">
              <Link to={`/editor/${proyecto.id}`}><Bot className="w-3.5 h-3.5 mr-1" /> Gestionar</Link>
            </Button>
            <Button asChild size="sm" className="h-8 px-3 bg-gradient-to-r from-violet-500 to-blue-500 hover:opacity-90">
              <Link to={`/exportar/${proyecto.id}`}><Share2 className="w-3.5 h-3.5 mr-1" /> Compartir</Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}