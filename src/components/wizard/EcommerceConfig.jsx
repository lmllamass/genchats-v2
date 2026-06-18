import { ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const PLATFORMS = [
  { value: "woocommerce", label: "WooCommerce" },
  { value: "shopify", label: "Shopify" },
  { value: "prestashop", label: "PrestaShop" },
  { value: "odoo", label: "Odoo" },
  { value: "ferreteria1", label: "Ferreteria1" },
  { value: "googlesheets", label: "Google Sheets" },
  { value: "otro", label: "Otro" },
];

const CAPABILITIES = [
  { key: "consultar_disponibilidad", label: "Consultar disponibilidad de producto" },
  { key: "mostrar_precio", label: "Mostrar precio" },
  { key: "guiar_producto", label: "Guiar al cliente hasta el producto" },
  { key: "tomar_pedido", label: "Tomar nota del pedido para contacto posterior" },
];

function PlatformFields({ platform, config, update }) {
  if (platform === "googlesheets") {
    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Enlace de la Google Sheet
        </label>
        <Input
          value={config.sheet_url || ""}
          onChange={(e) => update("sheet_url", e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="bg-secondary/50 border-border"
        />
        <p className="text-[10px] text-muted-foreground mt-1.5">
          La hoja debe ser pública o tener acceso de lectura. Incluye columnas como nombre, precio, stock, etc.
        </p>
      </div>
    );
  }

  if (platform === "odoo") {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">URL de Odoo</label>
          <Input value={config.store_url || ""} onChange={(e) => update("store_url", e.target.value)} placeholder="https://miempresa.odoo.com" className="bg-secondary/50 border-border" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Base de datos</label>
          <Input value={config.odoo_db || ""} onChange={(e) => update("odoo_db", e.target.value)} placeholder="nombre_base_datos" className="bg-secondary/50 border-border" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Usuario</label>
          <Input value={config.odoo_username || ""} onChange={(e) => update("odoo_username", e.target.value)} placeholder="admin@empresa.com" className="bg-secondary/50 border-border" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Contraseña / API Key</label>
          <Input type="password" value={config.odoo_password || ""} onChange={(e) => update("odoo_password", e.target.value)} placeholder="••••••••" className="bg-secondary/50 border-border" />
        </div>
      </div>
    );
  }

  if (platform === "ferreteria1") {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">ID de ferretería</label>
          <Input value={config.ferreteria_id || ""} onChange={(e) => update("ferreteria_id", e.target.value)} placeholder="ID en ferreteria1.app" className="bg-secondary/50 border-border" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Slug del tenant</label>
          <Input value={config.tenant_slug || ""} onChange={(e) => update("tenant_slug", e.target.value)} placeholder="mi-ferreteria" className="bg-secondary/50 border-border" />
        </div>
      </div>
    );
  }

  // woocommerce, shopify, prestashop, otro
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">URL de la tienda</label>
        <Input value={config.store_url || ""} onChange={(e) => update("store_url", e.target.value)} placeholder="https://mitienda.com" className="bg-secondary/50 border-border" />
      </div>
      {(platform === "woocommerce" || platform === "shopify" || platform === "prestashop") && (
        <>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">API Key</label>
            <Input value={config.api_key || ""} onChange={(e) => update("api_key", e.target.value)} placeholder="Clave de API" className="bg-secondary/50 border-border" />
          </div>
          {platform === "woocommerce" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Consumer Secret</label>
              <Input type="password" value={config.api_secret || ""} onChange={(e) => update("api_secret", e.target.value)} placeholder="••••••••" className="bg-secondary/50 border-border" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function EcommerceConfig({ config, onChange, showGoogleSheetsHint }) {
  const update = (key, val) => onChange({ ...config, [key]: val });
  const platform = config.platform || "otro";

  const toggleCapability = (key) => {
    const caps = config.capabilities || {};
    update("capabilities", { ...caps, [key]: !caps[key] });
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-6 md:p-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-primary" />
        </div>
        <h2 className="font-display text-xl font-semibold">Integración E-commerce</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Hemos detectado una tienda online. Configura la conexión para que el chatbot pueda consultar productos.
      </p>

      {showGoogleSheetsHint && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-6">
          <p className="text-xs text-amber-300/90 leading-relaxed">
            💡 <strong>No hemos identificado la plataforma exacta.</strong> Si tu CMS no está en la lista, 
            puedes seleccionar <strong>"Google Sheets"</strong> como plataforma y subir tu catálogo en una hoja de cálculo. 
            Es la forma más rápida de conectar tus productos.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Plataforma</label>
          <Select value={platform} onValueChange={(v) => update("platform", v)}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PlatformFields platform={platform} config={config} update={update} />

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-3 block">Capacidades del chatbot</label>
          <div className="space-y-3">
            {CAPABILITIES.map((cap) => (
              <label key={cap.key} className="flex items-center gap-3 cursor-pointer group">
                <Checkbox
                  checked={config.capabilities?.[cap.key] || false}
                  onCheckedChange={() => toggleCapability(cap.key)}
                />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {cap.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}