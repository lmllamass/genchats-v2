import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import EditorField from "./EditorField";

const FIELDS_BRAND = [
  { key: "logo_url", label: "Logo URL", placeholder: "https://..." },
  { key: "hero_image", label: "Imagen Hero", placeholder: "https://..." },
  { key: "color_primario", label: "Color primario", type: "color" },
  { key: "color_secundario", label: "Color secundario", type: "color" },
];

const FIELDS_CTA = [
  { key: "cta_texto", label: "Texto CTA", placeholder: "Empezar ahora" },
  { key: "cta_url", label: "URL CTA", placeholder: "#contacto" },
];

const FIELDS_CONTACT = [
  { key: "telefono", label: "Teléfono", placeholder: "+34..." },
  { key: "email", label: "Email", placeholder: "hola@..." },
  { key: "direccion", label: "Dirección", placeholder: "Ciudad, País" },
];

export default function EditorSidebar({ content, onChange }) {
  const set = (key, val) => onChange({ ...content, [key]: val });
  const sections = content.sections || [];

  const updateSection = (idx, field, val) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], [field]: val };
    onChange({ ...content, sections: updated });
  };

  const addSection = () => {
    onChange({ ...content, sections: [...sections, { title: "Nueva sección", body: "Contenido de la sección." }] });
  };

  const removeSection = (idx) => {
    const updated = sections.filter((_, i) => i !== idx);
    onChange({ ...content, sections: updated });
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-6">
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Encabezado</h3>
          <div className="space-y-4">
            <EditorField key="titulo" label="Título" placeholder="Título principal" value={content.titulo} onChange={(v) => set("titulo", v)} />
            <EditorField key="subtitulo" label="Subtítulo" placeholder="Descripción" value={content.subtitulo} onChange={(v) => set("subtitulo", v)} />
          </div>
        </div>
        <Separator />
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest">Secciones ({sections.length})</h3>
            <Button size="sm" variant="ghost" onClick={addSection} className="h-7 px-2 text-xs">
              <Plus className="w-3 h-3 mr-1" /> Añadir
            </Button>
          </div>
          <div className="space-y-4">
            {sections.map((s, i) => (
              <div key={i} className="rounded-lg bg-secondary/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Sección {i + 1}</span>
                  <button onClick={() => removeSection(i)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <EditorField label="Título" placeholder="Título" value={s.title} onChange={(v) => updateSection(i, "title", v)} />
                <EditorField label="Contenido" placeholder="Texto..." textarea value={s.body} onChange={(v) => updateSection(i, "body", v)} />
              </div>
            ))}
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Marca</h3>
          <div className="space-y-4">
            {FIELDS_BRAND.map(f => <EditorField key={f.key} {...f} value={content[f.key]} onChange={(v) => set(f.key, v)} />)}
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Call to Action</h3>
          <div className="space-y-4">
            {FIELDS_CTA.map(f => <EditorField key={f.key} {...f} value={content[f.key]} onChange={(v) => set(f.key, v)} />)}
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Contacto</h3>
          <div className="space-y-4">
            {FIELDS_CONTACT.map(f => <EditorField key={f.key} {...f} value={content[f.key]} onChange={(v) => set(f.key, v)} />)}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}