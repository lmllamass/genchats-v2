import { Globe, MessageCircle, Send, Smartphone, ShoppingCart } from "lucide-react";

const INTEGRATIONS = [
  { name: "Web", icon: Globe },
  { name: "WhatsApp", icon: MessageCircle },
  { name: "Telegram", icon: Send },
  { name: "iMessage", icon: Smartphone },
  { name: "WordPress", icon: "WP" },
  { name: "Shopify", icon: "S" },
  { name: "WooCommerce", icon: ShoppingCart },
  { name: "PrestaShop", icon: "PS" },
];

export default function IntegrationsSection() {
  return (
    <section className="py-20 border-t border-white/5" style={{ backgroundColor: "#111620" }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.25em] text-orange-400 mb-3">Integraciones</p>
          <h2 className="font-display text-[clamp(24px,3vw,36px)] font-bold text-white tracking-tight">
            Conecta donde estén tus clientes
          </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
          {INTEGRATIONS.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-3 px-5 py-3 rounded-xl"
              style={{ background: "#161b27", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {typeof item.icon === "string" ? (
                <span className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 text-xs font-bold">{item.icon}</span>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-orange-400" />
                </div>
              )}
              <span className="text-sm font-medium text-slate-300">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}