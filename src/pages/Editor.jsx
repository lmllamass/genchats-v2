import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { Proyecto } from "@/api/entidades";
import { api } from "@/api/backendApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Loader2, Share2, MessageCircle, ShoppingCart, Users, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ChatbotSidebar from "@/components/editor/ChatbotSidebar";
import EcommerceSidebar from "@/components/editor/EcommerceSidebar";
import LeadsPanel from "@/components/editor/LeadsPanel";
import ConversacionesPanel from "@/components/editor/ConversacionesPanel";
import ConversacionMessages from "@/components/editor/ConversacionMessages";
import ChatbotWidget from "@/components/chatbot/ChatbotWidget";
import ProBanner from "@/components/editor/ProBanner";
import ChannelsList from "@/components/editor/ChannelsList";
import WhatsAppSection from "@/components/editor/WhatsAppSection";
import RetellSection from "@/components/editor/RetellSection";
import PaymentSuccessModal from "@/components/editor/PaymentSuccessModal";
import { useSubscription } from "@/hooks/useSubscription";

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [showPaymentModal, setShowPaymentModal] = useState(searchParams.get("pago") === "ok");
  const { plan } = useSubscription();

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ["proyecto", id],
    queryFn: () => Proyecto.get(id),
    refetchOnWindowFocus: true,
  });

  const [config, setConfig] = useState(null);
  const [ecommerceConfig, setEcommerceConfig] = useState(null);
  const [activeTab, setActiveTab] = useState("conversaciones");
  const [activeConversacion, setActiveConversacion] = useState(null);

  // Guardamos la ecommerce config que ya está en BD para detectar cambios críticos
  const savedEcommerceRef = useRef(null);

  useEffect(() => {
    if (proyecto?.chatbot_config && !config) {
      setConfig(proyecto.chatbot_config);
    }
    if (proyecto && ecommerceConfig === null) {
      const ec = proyecto.ecommerce_config || { enabled: false, platform: '', store_url: '' };
      setEcommerceConfig(ec);
      savedEcommerceRef.current = ec;
    }
  }, [proyecto]);

  /**
   * Determina si el cambio de ecommerce config requiere regenerar el chatbot.
   * Solo regeneramos si cambia `enabled` o `platform`, que son los campos que
   * afectan al knowledge_base y a las herramientas disponibles en el loop de IA.
   */
  const ecommerceNeedsRegen = () => {
    const prev = savedEcommerceRef.current;
    const next = ecommerceConfig;
    if (!prev || !next) return false;
    return prev.enabled !== next.enabled || prev.platform !== next.platform;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Guardar cambios en BD
      await Proyecto.update(id, {
        chatbot_config: config,
        ecommerce_config: ecommerceConfig,
      });

      // 2. Si cambió enabled o platform, regenerar el chatbot para actualizar
      //    knowledge_base y system_prompt con el nuevo contexto de ecommerce
      if (ecommerceNeedsRegen()) {
        await api.generarChatbot(id);
        return { regenerated: true };
      }

      return { regenerated: false };
    },
    onSuccess: ({ regenerated }) => {
      queryClient.invalidateQueries({ queryKey: ["proyecto", id] });
      // Actualizar referencia para próximas comparaciones
      savedEcommerceRef.current = ecommerceConfig;

      if (regenerated) {
        toast.success("✅ Chatbot actualizado con la nueva configuración de ecommerce", {
          description: "El asistente ya conoce la nueva plataforma de tu tienda.",
          duration: 5000,
        });
      } else {
        toast.success("Cambios guardados");
      }
    },
    onError: (err) => {
      toast.error("Error al guardar: " + err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!proyecto) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Proyecto no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/app")}>Volver</Button>
      </div>
    );
  }

  const liveProyecto = { ...proyecto, chatbot_config: config || proyecto.chatbot_config, ecommerce_config: ecommerceConfig };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-1/3 border-r border-border shrink-0 flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Link to="/app" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display font-semibold truncate flex-1">{proyecto.nombre}</h1>
        </div>
        {/* Tabs — Conversaciones · Leads · Chatbot · E-commerce */}
        <div className="flex border-b border-border">
          {[
            { id: "conversaciones", icon: Inbox, label: "Inbox" },
            { id: "leads", icon: Users, label: "Leads" },
            { id: "chatbot", icon: MessageCircle, label: "Chatbot" },
            { id: "ecommerce", icon: ShoppingCart, label: "Tienda" },
          ].map(({ id: tid, icon: Icon, label }) => (
            <button
              key={tid}
              onClick={() => setActiveTab(tid)}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${activeTab === tid ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {activeTab === "conversaciones" && (
            <ConversacionesPanel
              proyectoId={id}
              activeConv={activeConversacion}
              onSelect={setActiveConversacion}
            />
          )}
          {activeTab === "chatbot" && (
            <>
              <ProBanner />
              <ChannelsList proyecto={proyecto} />
              <WhatsAppSection proyecto={proyecto} />
              <RetellSection proyecto={proyecto} />
              {config && <ChatbotSidebar config={config} onChange={setConfig} />}
            </>
          )}
          {activeTab === "ecommerce" && <EcommerceSidebar config={ecommerceConfig} onChange={setEcommerceConfig} />}
          {activeTab === "leads" && <LeadsPanel proyectoId={id} />}
        </div>
        {/* Save button at bottom of sidebar — hidden on conversaciones tab */}
        <div className={`p-4 border-t border-border ${activeTab === "conversaciones" ? "hidden" : ""}`}>
          <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {activeTab === "ecommerce" && ecommerceNeedsRegen()
                  ? "Actualizando chatbot..."
                  : "Guardando..."}
              </>
            ) : (
              <>
                {activeTab === "ecommerce" && ecommerceNeedsRegen()
                  ? <RefreshCw className="w-4 h-4 mr-2" />
                  : <Save className="w-4 h-4 mr-2" />}
                {activeTab === "ecommerce" && ecommerceNeedsRegen()
                  ? "Guardar y regenerar"
                  : "Guardar cambios"}
              </>
            )}
          </Button>
          {activeTab === "ecommerce" && ecommerceNeedsRegen() && (
            <p className="text-[10px] text-muted-foreground text-center mt-2 leading-tight">
              Se regenerará el chatbot para aplicar los cambios de ecommerce
            </p>
          )}
        </div>
      </div>

      {/* Main panel — Conversation view OR chatbot preview */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeTab === "conversaciones" ? (
          <ConversacionMessages
            conversation={activeConversacion}
            onTakeoverChange={(updated) => {
              setActiveConversacion(updated);
            }}
          />
        ) : (
          <>
            <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <span className="text-sm text-muted-foreground">Vista previa del chatbot</span>
              <Button variant="outline" size="sm" onClick={() => navigate(`/exportar/${id}`)}>
                <Share2 className="w-4 h-4 mr-2" /> Exportar
              </Button>
            </div>
            <div className="flex-1 flex items-center justify-center bg-secondary/30 p-8 overflow-auto min-w-0">
              <div className="w-full max-w-md">
                <ChatbotWidget proyecto={liveProyecto} embedded />
              </div>
            </div>
          </>
        )}
      </div>

      {showPaymentModal && (
        <PaymentSuccessModal onClose={() => {
          setShowPaymentModal(false);
          window.history.replaceState({}, "", `/editor/${id}`);
          queryClient.invalidateQueries({ queryKey: ["proyecto", id] });
        }} />
      )}
    </div>
  );
}
