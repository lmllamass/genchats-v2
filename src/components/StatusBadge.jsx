import { ESTADO_LABELS } from "@/lib/templates";

export default function StatusBadge({ estado }) {
  const cfg = ESTADO_LABELS[estado] || ESTADO_LABELS.scrapeando;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${cfg.color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {cfg.label}
    </span>
  );
}