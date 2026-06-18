import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentSuccessModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="font-display text-xl font-bold mb-2">¡Pago recibido!</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Tu plan Pro se activará en menos de 5 minutos.
        </p>
        <Button onClick={onClose} className="w-full bg-gradient-to-r from-violet-500 to-blue-500 hover:opacity-90">
          Entendido
        </Button>
      </div>
    </div>
  );
}