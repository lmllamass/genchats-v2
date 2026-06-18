import { useQuery } from "@tanstack/react-query";
import { MensajeWA } from "@/api/entidades";
import { MessageCircle, User } from "lucide-react";
import moment from "moment";

export default function WhatsAppConversations({ proyectoId }) {
  const { data: mensajes = [] } = useQuery({
    queryKey: ["mensajes-wa", proyectoId],
    queryFn: () => MensajeWA.list(proyectoId, 50),
    refetchInterval: 30000,
  });

  // Group by from_number
  const grouped = {};
  for (const m of mensajes) {
    if (!m.from_number) continue;
    if (!grouped[m.from_number]) {
      grouped[m.from_number] = { phone: m.from_number, messages: [], lastDate: m.created_at };
    }
    grouped[m.from_number].messages.push(m);
    if (m.created_at > grouped[m.from_number].lastDate) {
      grouped[m.from_number].lastDate = m.created_at;
    }
  }

  const conversations = Object.values(grouped)
    .sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));

  if (!conversations.length) {
    return (
      <div className="text-center py-4">
        <MessageCircle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Sin conversaciones aún</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-xs text-muted-foreground font-medium">Últimas conversaciones</span>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {conversations.slice(0, 10).map(conv => (
          <div key={conv.phone} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/30 border border-border">
            <User className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{conv.phone}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {conv.messages[0]?.mensaje?.substring(0, 40) || "..."}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-muted-foreground">{moment(conv.lastDate).fromNow()}</span>
              <span className="block text-[10px] text-primary">{conv.messages.length} msgs</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
