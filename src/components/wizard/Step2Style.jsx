import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Bell, ShoppingCart, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EcommerceConfig from "@/components/wizard/EcommerceConfig";
import GoogleSheetsOffer from "@/components/wizard/GoogleSheetsOffer";

export default function Step2Style({ data, setData, onNext, onBack }) {
  const meta = data.metadata_scrapeado || {};
  const hasEcommerce = meta.tiene_ecommerce;
  const knownPlatform = meta.plataforma_ecommerce && meta.plataforma_ecommerce !== 'otro';
  const [wantsProducts, setWantsProducts] = useState(data.ecommerce_config?.enabled || false);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Caso 1: Ecommerce detectado con plataforma conocida */}
      {hasEcommerce && knownPlatform && (
        <EcommerceConfig
          config={data.ecommerce_config || {
            enabled: true,
            platform: meta.plataforma_ecommerce,
            store_url: data.url_origen || '',
            capabilities: { consultar_disponibilidad: true, mostrar_precio: true, guiar_producto: true, tomar_pedido: true },
          }}
          onChange={(cfg) => setData(p => ({ ...p, ecommerce_config: { ...cfg, enabled: true } }))}
        />
      )}

      {/* Caso 2: Ecommerce detectado pero plataforma NO reconocida */}
      {hasEcommerce && !knownPlatform && (
        <EcommerceConfig
          config={data.ecommerce_config || {
            enabled: true,
            platform: 'otro',
            store_url: data.url_origen || '',
            capabilities: { consultar_disponibilidad: true, mostrar_precio: true, guiar_producto: true, tomar_pedido: true },
          }}
          onChange={(cfg) => setData(p => ({ ...p, ecommerce_config: { ...cfg, enabled: true } }))}
          showGoogleSheetsHint
        />
      )}

      {/* Caso 3: NO se detectó ecommerce — ofrecer Google Sheets */}
      {!hasEcommerce && (
        <GoogleSheetsOffer
          active={wantsProducts}
          onToggle={(v) => {
            setWantsProducts(v);
            if (v) {
              setData(p => ({
                ...p,
                ecommerce_config: {
                  enabled: true,
                  platform: 'googlesheets',
                  sheet_url: '',
                  capabilities: { consultar_disponibilidad: true, mostrar_precio: true, guiar_producto: true, tomar_pedido: true },
                }
              }));
            } else {
              setData(p => ({ ...p, ecommerce_config: { enabled: false } }));
            }
          }}
          config={data.ecommerce_config || {}}
          onChange={(cfg) => setData(p => ({ ...p, ecommerce_config: cfg }))}
        />
      )}

      {/* Notificaciones de leads */}
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <h2 className="font-display text-xl font-semibold">Notificaciones de contactos</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Recibe un email cuando el chatbot capture un nuevo contacto con sus datos y la transcripción de la consulta.
        </p>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email de notificación</label>
          <Input
            type="email"
            value={data.chatbot_config?.notification_email || ""}
            onChange={(e) => setData(p => ({
              ...p,
              chatbot_config: { ...(p.chatbot_config || {}), notification_email: e.target.value }
            }))}
            placeholder="tu@email.com"
            className="bg-secondary/50 border-border"
          />
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Opcional — déjalo vacío si no quieres recibir notificaciones.
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" /> Atrás</Button>
        <Button onClick={onNext} className="bg-gradient-to-r from-violet-500 to-blue-500 hover:opacity-90">Continuar <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    </motion.div>
  );
}