import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function EditorField({ label, value, onChange, textarea = false, type = "text", placeholder, textareaClass }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">{label}</label>
      {textarea ? (
        <Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`bg-secondary/50 border-border resize-y ${textareaClass || "min-h-[90px]"}`} />
      ) : type === "color" ? (
        <div className="flex gap-2 items-center">
          <input type="color" value={value || "#2563EB"} onChange={(e) => onChange(e.target.value)} className="w-12 h-10 rounded-lg border border-border bg-transparent cursor-pointer" />
          <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className="bg-secondary/50 border-border h-10 flex-1 font-mono text-xs" />
        </div>
      ) : (
        <Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="bg-secondary/50 border-border h-10" />
      )}
    </div>
  );
}