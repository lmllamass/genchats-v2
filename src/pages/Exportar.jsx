import { useParams, useNavigate, Link } from "react-router-dom";
import { Proyecto } from "@/api/entidades";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmbedCode from "@/components/chatbot/EmbedCode";
import ChatbotWidget from "@/components/chatbot/ChatbotWidget";

export default function Exportar() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ["proyecto", id],
    queryFn: () => Proyecto.get(id),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!proyecto) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Proyecto no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/app")}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/app" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold">{proyecto.nombre}</h1>
          <p className="text-sm text-muted-foreground">Exporta e integra tu chatbot</p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/editor/${id}`)}>
          <Pencil className="w-4 h-4 mr-2" /> Editar chatbot
        </Button>
      </div>

      <EmbedCode proyecto={proyecto} />

      <div>
        <h3 className="font-display font-semibold mb-4">Vista previa</h3>
        <div className="max-w-md mx-auto">
          <ChatbotWidget proyecto={proyecto} embedded />
        </div>
      </div>
    </div>
  );
}
