import { useState } from "react";
import { Lead } from "@/api/entidades";
import { useQuery } from "@tanstack/react-query";
import { Users, Mail, Phone, Building2, Clock, MessageCircle, Loader2, ChevronDown, ChevronUp, Globe, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import moment from "moment";

const ESTADO_COLORS = {
  nuevo: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  contactado: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  cualificado: "bg-green-500/10 text-green-400 border-green-500/20",
  descartado: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const CANAL_ICONS = {
  web: "🌐",
  whatsapp: "💬",
  telegram: "✈️",
  embed: "🔗",
};

function LeadCard({ lead }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
      <button className="w-full flex items-center justify-between" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">{CANAL_ICONS[lead.canal] || "🌐"}</span>
          <span className="text-sm font-medium truncate">
            {lead.nombre || lead.email || lead.telefono || "Visitante anónimo"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`text-[10px] ${ESTADO_COLORS[lead.estado] || ""}`}>
            {lead.estado}
          </Badge>
          {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>

      {/* Summary row always visible */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
        <div className="flex items-center gap-1">
          <MessageCircle className="w-3 h-3" />
          <span>{lead.mensajes_count || 0} msgs</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{moment(lead.ultimo_mensaje || lead.created_at).fromNow()}</span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-1.5 pt-1 border-t border-border/50">
          {lead.nombre && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="w-3 h-3 shrink-0" />
              <span>{lead.nombre}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.telefono && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3 shrink-0" />
              <span>{lead.telefono}</span>
            </div>
          )}
          {lead.empresa && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="w-3 h-3 shrink-0" />
              <span>{lead.empresa}</span>
            </div>
          )}
          {lead.canal && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="w-3 h-3 shrink-0" />
              <span>Canal: {lead.canal}</span>
            </div>
          )}
          {lead.visitor_id && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
              <Hash className="w-3 h-3 shrink-0" />
              <span className="truncate font-mono text-[10px]">{lead.visitor_id}</span>
            </div>
          )}
          {lead.notas && (
            <p className="text-xs text-muted-foreground/80 italic mt-1">"{lead.notas}"</p>
          )}
          {!lead.nombre && !lead.email && !lead.telefono && !lead.notas && (
            <p className="text-xs text-muted-foreground/50 italic">Conversación iniciada, sin datos aún</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeadsPanel({ proyectoId }) {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", proyectoId],
    queryFn: () => Lead.list(proyectoId, 50),
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Leads captados</h3>
            <p className="text-[11px] text-muted-foreground">{leads.length} contacto{leads.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <Separator />

        {leads.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Aún no hay leads. El chatbot captará datos de contacto automáticamente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
