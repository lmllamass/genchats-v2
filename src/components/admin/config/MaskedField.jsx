import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Copy } from "lucide-react";
import { toast } from "sonner";

export default function MaskedField({ label, value, onChange, placeholder, readOnly, showCopy, hint }) {
  const [visible, setVisible] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value || "");
    toast.success("📋 Copiado al portapapeles");
  };

  return (
    <div>
      {label && <label className="text-xs text-orange-300/80 mb-1 block font-medium">{label}</label>}
      <div className="flex gap-2">
        <Input
          type={visible || readOnly ? "text" : "password"}
          value={value || ""}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          placeholder={placeholder}
          readOnly={readOnly}
          className="bg-white/5 border-white/10 text-white/90 placeholder:text-white/30 flex-1"
        />
        {!readOnly && (
          <Button type="button" variant="ghost" size="icon" onClick={() => setVisible(!visible)}
            className="text-white/50 hover:text-white/80 shrink-0">
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        )}
        {(showCopy || readOnly) && (
          <Button type="button" variant="ghost" size="icon" onClick={handleCopy}
            className="text-white/50 hover:text-orange-400 shrink-0">
            <Copy className="w-4 h-4" />
          </Button>
        )}
      </div>
      {hint && <p className="text-[10px] text-white/30 mt-1">{hint}</p>}
    </div>
  );
}