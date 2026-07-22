import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import EditorField from "./EditorField";

export default function ChatbotSidebar({ config, onChange }) {
  const set = (key, val) => onChange({ ...config, [key]: val });

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-6">
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Negocio</h3>
          <div className="space-y-4">
            <EditorField label="Nombre" placeholder="Mi Negocio" value={config.nombre_negocio} onChange={v => set("nombre_negocio", v)} />
            <EditorField label="Descripción" placeholder="Descripción breve" textarea value={config.descripcion} onChange={v => set("descripcion", v)} />
            <EditorField label="Logo URL" placeholder="https://..." value={config.logo_url} onChange={v => set("logo_url", v)} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Apariencia</h3>
          <div className="space-y-4">
            <EditorField label="Color primario" type="color" value={config.color_primario} onChange={v => set("color_primario", v)} />
            <EditorField label="Color secundario" type="color" value={config.color_secundario} onChange={v => set("color_secundario", v)} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Mensaje de bienvenida</h3>
          <EditorField label="Saludo" placeholder="¡Hola! ¿En qué puedo ayudarte?" textarea value={config.welcome_message} onChange={v => set("welcome_message", v)} />
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Contacto</h3>
          <div className="space-y-4">
            <EditorField label="Teléfono" placeholder="+34..." value={config.telefono} onChange={v => set("telefono", v)} />
            <EditorField label="Email" placeholder="hola@..." value={config.email} onChange={v => set("email", v)} />
            <EditorField label="Dirección" placeholder="Ciudad, País" value={config.direccion} onChange={v => set("direccion", v)} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Notificaciones</h3>
          <div className="space-y-2">
            <EditorField label="Email de notificación" placeholder="tu@email.com" value={config.notification_email} onChange={v => set("notification_email", v)} />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Recibirás un email cada vez que el chatbot capture un nuevo contacto con sus datos y la transcripción de la conversación.
            </p>
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-1">Contexto del chatbot</h3>
          <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
            Toda la información que el chatbot usará para responder: servicios, productos, precios, horarios, FAQs, políticas…
            Se usa en web, WhatsApp y Telegram.
          </p>
          <EditorField label="Base de conocimiento" placeholder="Escribe aquí toda la información sobre tu negocio que el chatbot debe conocer..." textarea textareaClass="min-h-[220px]" value={config.knowledge_base} onChange={v => set("knowledge_base", v)} />
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-1">Contexto para Voz (Retell)</h3>
          <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
            Opcional. Si lo dejas vacío, el agente de voz usará la misma Base de conocimiento de arriba.
            Rellénalo solo si necesitas que en las llamadas telefónicas diga cosas distintas (p. ej. un guion
            de venta o instrucciones que no aplican por escrito).
          </p>
          <EditorField label="Base de conocimiento (Voz)" placeholder="Déjalo vacío para usar la Base de conocimiento general. Solo rellénalo si la voz necesita un contexto distinto..." textarea textareaClass="min-h-[160px]" value={config.knowledge_base_voz} onChange={v => set("knowledge_base_voz", v)} />
        </div>
      </div>
    </ScrollArea>
  );
}