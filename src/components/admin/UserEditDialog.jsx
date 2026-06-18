import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

export default function UserEditDialog({ user, open, onClose, onSave, saving }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (user) {
      setForm({
        telefono: user.telefono || "",
        empresa: user.empresa || "",
        direccion: user.direccion || "",
        plan: user.plan || "free",
        role: user.role || "user",
        notas_admin: user.notas_admin || "",
      });
    }
  }, [user]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    const data = { ...form };
    if (data.plan === "pro" && user.plan !== "pro") {
      data.plan_activated_at = new Date().toISOString();
    }
    onSave(user.id, data);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display">Editar usuario</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nombre</Label>
              <div className="text-sm font-medium mt-1">{user.full_name || "—"}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <div className="text-sm font-medium mt-1 truncate">{user.email}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Teléfono</Label>
              <Input value={form.telefono} onChange={e => set("telefono", e.target.value)} placeholder="+34 600 000 000" className="mt-1 bg-secondary/50 border-border h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Empresa</Label>
              <Input value={form.empresa} onChange={e => set("empresa", e.target.value)} placeholder="Nombre empresa" className="mt-1 bg-secondary/50 border-border h-9 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Dirección</Label>
            <Input value={form.direccion} onChange={e => set("direccion", e.target.value)} placeholder="Calle, ciudad, CP" className="mt-1 bg-secondary/50 border-border h-9 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Plan</Label>
              <Select value={form.plan} onValueChange={v => set("plan", v)}>
                <SelectTrigger className="mt-1 bg-secondary/50 border-border h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Rol</Label>
              <Select value={form.role} onValueChange={v => set("role", v)}>
                <SelectTrigger className="mt-1 bg-secondary/50 border-border h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Notas admin</Label>
            <Textarea value={form.notas_admin} onChange={e => set("notas_admin", e.target.value)} placeholder="Notas internas…" className="mt-1 bg-secondary/50 border-border text-sm h-20" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-violet-500 to-blue-500 hover:opacity-90">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}