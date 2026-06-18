import MaskedField from "./MaskedField";
import { CreditCard } from "lucide-react";

export default function StripeBlock({ form, setField }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">Stripe</h3>
          <p className="text-[11px] text-white/40">Claves de pasarela de pagos</p>
        </div>
      </div>

      <MaskedField label="Secret Key" value={form.stripe_secret_key} onChange={v => setField("stripe_secret_key", v)} placeholder="sk_live_..." showCopy />
      <MaskedField label="Webhook Secret" value={form.stripe_webhook_secret} onChange={v => setField("stripe_webhook_secret", v)} placeholder="whsec_..." showCopy />
      <MaskedField label="Price ID Pro (49€/mes)" value={form.stripe_price_id_pro} onChange={v => setField("stripe_price_id_pro", v)} placeholder="price_..." />
      <MaskedField label="Price ID Instalación (69€)" value={form.stripe_price_id_instalacion} onChange={v => setField("stripe_price_id_instalacion", v)} placeholder="price_..." />
    </div>
  );
}