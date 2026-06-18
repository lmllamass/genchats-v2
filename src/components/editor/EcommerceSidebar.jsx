import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Store, Key, Database, User, Lock, FileSpreadsheet } from "lucide-react";
import EditorField from "./EditorField";

const PLATFORMS = [
  { value: "ferreteria1", label: "Ferreteria1.app", fields: ["api_key", "ferreteria_id", "tenant_slug"] },
  { value: "prestashop", label: "PrestaShop", fields: ["api_key"] },
  { value: "woocommerce", label: "WooCommerce", fields: ["api_key", "api_secret"] },
  { value: "shopify", label: "Shopify", fields: ["api_key"] },
  { value: "odoo", label: "Odoo", fields: ["odoo_db", "odoo_username", "odoo_password"] },
  { value: "googlesheets", label: "Google Sheets", fields: ["sheet_url"] },
];

const FIELD_CONFIG = {
  api_key: { label: "API Key / Bearer Token", placeholder: "Tu API key...", icon: Key },
  api_secret: { label: "Consumer Secret", placeholder: "Tu consumer secret...", icon: Lock },
  ferreteria_id: { label: "Ferretería ID", placeholder: "ID de la ferretería en Base44", icon: Database },
  tenant_slug: { label: "Tenant Slug", placeholder: "mi-ferreteria", icon: Store },
  odoo_db: { label: "Base de datos", placeholder: "nombre_bd", icon: Database },
  odoo_username: { label: "Usuario", placeholder: "admin@ejemplo.com", icon: User },
  odoo_password: { label: "Contraseña / API Key", placeholder: "••••••••", icon: Lock },
  sheet_url: { label: "URL de la Google Sheet (pública)", placeholder: "https://docs.google.com/spreadsheets/d/...", icon: FileSpreadsheet },
};

const PLATFORM_HELP = {
  ferreteria1: "Introduce el ID de tu ferretería, el slug del tenant y la API Key (Bearer token) generada desde ferreteria1.app. Tu chatbot tendrá acceso al catálogo propio + 600.000 referencias del catálogo global Daterium.",
  prestashop: "Genera tu API key en Parámetros Avanzados → Webservice de tu panel PrestaShop.",
  woocommerce: "Genera tus claves en WooCommerce → Ajustes → Avanzado → REST API.",
  shopify: "Crea una app privada en tu admin de Shopify → Configuración → Apps → Desarrollar apps.",
  odoo: "Usa tus credenciales de acceso a Odoo. Asegúrate de tener permisos de lectura en productos.",
  googlesheets: "Pega la URL de una Google Sheet pública con tu inventario. La hoja debe tener las columnas: nombre, precio, stock, categoría, url. La sheet debe estar compartida como \"Cualquier persona con el enlace puede ver\".",
};

export default function EcommerceSidebar({ config, onChange }) {
  const econfig = config || { enabled: false, platform: '', store_url: '' };
  const set = (key, val) => onChange({ ...econfig, [key]: val });

  const selectedPlatform = PLATFORMS.find(p => p.value === econfig.platform);

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">E-commerce</h3>
              <p className="text-[11px] text-muted-foreground">Consulta de productos</p>
            </div>
          </div>
          <Switch
            checked={!!econfig.enabled}
            onCheckedChange={(v) => set("enabled", v)}
            className="data-[state=unchecked]:bg-muted-foreground/30"
          />
        </div>

        {econfig.enabled && (
          <>
            <Separator />

            {/* Platform select */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Plataforma</label>
              <Select value={econfig.platform || ''} onValueChange={(v) => set("platform", v)}>
                <SelectTrigger className="bg-secondary/50 border-border h-10">
                  <SelectValue placeholder="Selecciona plataforma" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5" />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {econfig.platform && (
              <>
                {/* Help text */}
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    💡 {PLATFORM_HELP[econfig.platform]}
                  </p>
                </div>

                {/* Google Sheets example */}
                {econfig.platform === 'googlesheets' && (
                  <div className="rounded-lg bg-secondary/50 border border-border p-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground">📋 Formato de la Google Sheet:</p>
                    <div className="rounded bg-background/50 border border-border p-2 overflow-x-auto">
                      <table className="text-[10px] text-muted-foreground w-full">
                        <thead>
                          <tr className="text-foreground">
                            <th className="text-left pr-2 pb-1">nombre</th>
                            <th className="text-left pr-2 pb-1">precio</th>
                            <th className="text-left pr-2 pb-1">stock</th>
                            <th className="text-left pr-2 pb-1">categoría</th>
                            <th className="text-left pb-1">url</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="pr-2">Martillo 500g</td>
                            <td className="pr-2">12.50</td>
                            <td className="pr-2">25</td>
                            <td className="pr-2">Herramientas</td>
                            <td className="truncate max-w-[80px]">https://...</td>
                          </tr>
                          <tr>
                            <td className="pr-2">Pintura blanca 5L</td>
                            <td className="pr-2">29.90</td>
                            <td className="pr-2">10</td>
                            <td className="pr-2">Pinturas</td>
                            <td className="truncate max-w-[80px]">https://...</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Columnas opcionales: <strong>descripción</strong>, <strong>sku</strong>, <strong>marca</strong>. 
                      La hoja debe estar compartida como <em>"Cualquier persona con el enlace puede ver"</em>.
                    </p>
                  </div>
                )}

                {/* Store URL (not for Google Sheets) */}
                {econfig.platform !== 'googlesheets' && (
                  <EditorField
                    label="URL de la tienda"
                    placeholder="https://mitienda.com"
                    value={econfig.store_url}
                    onChange={(v) => set("store_url", v)}
                  />
                )}

                {/* Dynamic fields based on platform */}
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">
                    {econfig.platform === 'googlesheets' ? 'Configuración' : 'Credenciales'}
                  </h3>
                  <div className="space-y-4">
                    {selectedPlatform?.fields.map(field => {
                      const fc = FIELD_CONFIG[field];
                      return (
                        <EditorField
                          key={field}
                          label={fc.label}
                          placeholder={fc.placeholder}
                          value={econfig[field]}
                          onChange={(v) => set(field, v)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Status indicator */}
                <Separator />
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {econfig.platform === 'ferreteria1' && 'Ferreteria1 REST API + Daterium'}
                    {econfig.platform === 'prestashop' && 'PrestaShop API'}
                    {econfig.platform === 'woocommerce' && 'WooCommerce REST API v3'}
                    {econfig.platform === 'shopify' && 'Shopify Admin API 2024-01'}
                    {econfig.platform === 'odoo' && 'Odoo JSON-RPC'}
                    {econfig.platform === 'googlesheets' && 'Google Sheets (CSV público)'}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  El chatbot podrá consultar productos, precios, stock y categorías en tiempo real.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}