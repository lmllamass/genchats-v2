import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function EditorField({ label, value, onChange, textarea = false, type = "text", placeholder, textareaClass, expandable = false }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">{label}</label>
        {textarea && expandable && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            title="Editar en grande"
          >
            <Maximize2 className="w-3 h-3" /> Ampliar
          </button>
        )}
      </div>
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

      {textarea && expandable && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl w-[90vw]">
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
            </DialogHeader>
            <Textarea
              autoFocus
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="bg-secondary/50 border-border resize-y min-h-[55vh] text-sm leading-relaxed"
            />
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Hecho</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}