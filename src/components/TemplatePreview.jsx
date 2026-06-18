import { COLOR_SCHEMES } from "@/lib/templates";

export default function TemplatePreview({ template, scheme, className = "" }) {
  const cs = COLOR_SCHEMES[scheme] || COLOR_SCHEMES.azul_profesional;
  const isDark = scheme === "oscuro_premium";
  const cfg = { moderna: "gradient", clasica: "centered", minimalista: "left", corporativa: "border", ecommerce: "soft" }[template] || "gradient";

  return (
    <div className={`relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-border/60 ${className}`} style={{ background: cs.bg }}>
      <div className="absolute top-0 inset-x-0 h-5 px-2 flex items-center justify-between">
        <div className="w-8 h-1.5 rounded-sm" style={{ background: cs.primary }} />
        <div className="w-10 h-2 rounded-sm" style={{ background: cs.primary }} />
      </div>
      <div className="absolute top-5 inset-x-0 flex flex-col gap-1.5 px-4 justify-center" style={{
        height: "60%",
        background: cfg === "gradient" ? `linear-gradient(135deg, ${cs.primary}, ${cs.secondary})` : "transparent",
        borderBottom: cfg === "border" ? `2px solid ${cs.primary}` : "none",
        alignItems: cfg === "left" ? "flex-start" : "center",
        color: cfg === "gradient" ? "#fff" : cs.text,
      }}>
        <div className="h-2 rounded-sm w-3/4" style={{ background: cfg === "gradient" ? "rgba(255,255,255,0.95)" : cs.text, opacity: cfg === "gradient" ? 1 : 0.85 }} />
        <div className="h-1.5 rounded-sm w-1/2" style={{ background: cfg === "gradient" ? "rgba(255,255,255,0.7)" : cs.text, opacity: cfg === "gradient" ? 1 : 0.5 }} />
        <div className="mt-1 h-2.5 w-12 rounded-sm" style={{ background: cfg === "gradient" ? "#fff" : cs.primary }} />
      </div>
      <div className="absolute bottom-3 inset-x-0 px-3 grid grid-cols-3 gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="rounded-sm p-1.5" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#fff", borderTop: template === "corporativa" ? `2px solid ${cs.primary}` : "none" }}>
            <div className="w-2 h-2 rounded-full mb-1" style={{ background: cs.primary }} />
            <div className="h-1 rounded-sm" style={{ background: cs.text, opacity: 0.5 }} />
          </div>
        ))}
      </div>
    </div>
  );
}