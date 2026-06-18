import { ShoppingCart, FileSpreadsheet, ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const CAPABILITIES = [
  { key: "consultar_disponibilidad", label: "Consultar disponibilidad de producto" },
  { key: "mostrar_precio", label: "Mostrar precio" },
  { key: "guiar_producto", label: "Guiar al cliente hasta el producto" },
  { key: "tomar_pedido", label: "Tomar nota del pedido para contacto posterior" },
];

export default function GoogleSheetsOffer({ active, onToggle, config, onChange }) {
  const update = (key, val) => onChange({ ...config, [key]: val });

  const toggleCapability = (key) => {
    const caps = config.capabilities || {};
    update("capabilities", { ...caps, [key]: !caps[key] });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">¿Vendes productos o servicios?</h2>
            <p className="text-sm text-muted-foreground">No hemos detectado una tienda online, pero puedes añadir tu catálogo.</p>
          </div>
        </div>
        <Switch
          checked={active}
          onCheckedChange={onToggle}
          className="data-[state=unchecked]:bg-muted-foreground/30"
        />
      </div>

      {active && (
        <div className="space-y-5 mt-4 pt-4 border-t border-border">
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">Google Sheets como catálogo</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Crea una hoja de cálculo con tus productos y pega la URL aquí. 
              El chatbot podrá consultar productos, precios y disponibilidad en tiempo real.
            </p>
          </div>

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
          </div>

          {/* Instrucciones formato */}
          <div className="rounded-lg bg-secondary/50 border border-border p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">📋 Formato requerido de la Google Sheet:</p>
            <div className="rounded bg-background/50 border border-border p-2 overflow-x-auto">
              <table className="text-[10px] text-muted-foreground w-full">
                <thead>
                  <tr className="text-foreground">
                    <th className="text-left pr-3 pb-1">nombre</th>
                    <th className="text-left pr-3 pb-1">precio</th>
                    <th className="text-left pr-3 pb-1">stock</th>
                    <th className="text-left pr-3 pb-1">categoría</th>
                    <th className="text-left pb-1">url</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="pr-3">Producto ejemplo</td>
                    <td className="pr-3">19.90</td>
                    <td className="pr-3">15</td>
                    <td className="pr-3">General</td>
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

          {/* Capacidades */}
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
      )}
    </div>
  );
}