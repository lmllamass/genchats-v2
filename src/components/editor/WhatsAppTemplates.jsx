import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/backendApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Plus, Trash2, Loader2, CheckCircle2, XCircle, Clock3 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "UTILITY", label: "Utilidad (notificación transaccional)" },
  { value: "MARKETING", label: "Marketing" },
  { value: "AUTHENTICATION", label: "Autenticación (código de verificación)" },
];

const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "es_MX", label: "Español (México)" },
  { value: "en_US", label: "Inglés (US)" },
  { value: "en", label: "Inglés" },
];

const STATUS_META = {
  APPROVED: { label: "Aprobada", icon: CheckCircle2, cls: "border-green-500/30 text-green-300 bg-green-500/10" },
  PENDING: { label: "Pendiente en Meta", icon: Clock3, cls: "border-amber-500/30 text-amber-300 bg-amber-500/10" },
  REJECTED: { label: "Rechazada", icon: XCircle, cls: "border-red-500/30 text-red-300 bg-red-500/10" },
};

function emptyForm() {
  return { name: "", language: "es", category: "UTILITY", bodyText: "", bodyExample: "", footerText: "" };
}

export default function WhatsAppTemplates({ proyectoId }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const { data, isLoading, error } = useQuery({
    queryKey: ["whatsapp-templates", proyectoId],
    queryFn: () => api.listWhatsAppTemplates(proyectoId),
    enabled: !!proyectoId,
    refetchInterval: 60000,
  });
  const templates = data?.templates || [];

  const createMutation = useMutation({
    mutationFn: (payload) => api.createWhatsAppTemplate(payload),
    onSuccess: () => {
      toast.success("Plantilla enviada a revisión de Meta. Suele tardar un par de horas.");
      setOpen(false);
      setForm(emptyForm());
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates", proyectoId] });
    },
    onError: (err) => toast.error(err?.message || "Error al crear la plantilla"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ name, language }) => api.deleteWhatsAppTemplate(proyectoId, name, language),
    onSuccess: () => {
      toast.success("Plantilla eliminada");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates", proyectoId] });
    },
    onError: (err) => toast.error(err?.message || "Error al eliminar la plantilla"),
  });

  const handleSubmit = () => {
    const varCount = (form.bodyText.match(/\{\{\d+\}\}/g) || []).length;
    const bodyExample = form.bodyExample
      ? form.bodyExample.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    if (varCount > 0 && bodyExample.length < varCount) {
      toast.error(`El texto usa ${varCount} variable(s) {{1}}, {{2}}... — añade ${varCount} valor(es) de ejemplo separados por coma.`);
      return;
    }
    createMutation.mutate({
      proyecto_id: proyectoId,
      name: form.name.trim().toLowerCase().replace(/\s+/g, "_"),
      language: form.language,
      category: form.category,
      bodyText: form.bodyText.trim(),
      bodyExample,
      footerText: form.footerText.trim() || undefined,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">Plantillas de WhatsApp (Meta)</span>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nueva
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando plantillas...
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 py-1">{error.message}</p>
      )}

      {!isLoading && !error && templates.length === 0 && (
        <div className="text-center py-3">
          <FileText className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Sin plantillas todavía</p>
        </div>
      )}

      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {templates.map((t) => {
          const meta = STATUS_META[t.status] || STATUS_META.PENDING;
          const StatusIcon = meta.icon;
          return (
            <div key={`${t.name}-${t.language}`} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-secondary/30 border border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-medium truncate">{t.name}</p>
                  <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>
                    <StatusIcon className="w-3 h-3 mr-1" /> {meta.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{t.language}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {t.components?.find((c) => c.type === "BODY")?.text}
                </p>
                {t.status === "REJECTED" && t.rejectedReason && (
                  <p className="text-[10px] text-red-400 mt-0.5">Motivo: {t.rejectedReason}</p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-400"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ name: t.name, language: t.language })}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva plantilla de WhatsApp</DialogTitle>
            <DialogDescription>
              Se envía a revisión de Meta. Aprobación en un par de horas normalmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre interno</Label>
              <Input
                placeholder="seguimiento_llamada"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">Solo minúsculas, números y guion bajo. No se puede cambiar después.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoría</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Idioma</Label>
                <Select value={form.language} onValueChange={(v) => setForm((f) => ({ ...f, language: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Texto del mensaje</Label>
              <Textarea
                placeholder="Hola, te escribimos desde {{1}} con la información que nos pediste."
                value={form.bodyText}
                onChange={(e) => setForm((f) => ({ ...f, bodyText: e.target.value }))}
                className="min-h-20 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Usa {"{{1}}"}, {"{{2}}"}... para variables (ej. nombre del negocio).</p>
            </div>

            {(form.bodyText.match(/\{\{\d+\}\}/g) || []).length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Ejemplos de las variables (separados por coma)</Label>
                <Input
                  placeholder="Suministros Aguado"
                  value={form.bodyExample}
                  onChange={(e) => setForm((f) => ({ ...f, bodyExample: e.target.value }))}
                  className="h-9"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Pie de página (opcional)</Label>
              <Input
                placeholder="Enviado automáticamente"
                value={form.footerText}
                onChange={(e) => setForm((f) => ({ ...f, footerText: e.target.value }))}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || !form.name || !form.bodyText}>
              {createMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>) : "Enviar a revisión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
