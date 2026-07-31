import { useState, useEffect, useMemo } from "react";
import { api } from "@/api/backendApi";
import { Send, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function bodyOf(template) {
  return template.components?.find(c => (c.type || "").toUpperCase() === "BODY")?.text || "";
}
function varCount(bodyText) {
  return (bodyText.match(/\{\{\d+\}\}/g) || []).length;
}

export default function PlantillaPicker({ proyectoId, onSent }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedName, setSelectedName] = useState("");
  const [params, setParams] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.listWhatsappTemplates(proyectoId)
      .then(res => {
        if (!active) return;
        const aprobadas = (res?.templates || []).filter(t => (t.status || "").toUpperCase() === "APPROVED");
        setTemplates(aprobadas);
      })
      .catch(() => toast.error("No se pudieron cargar las plantillas"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [proyectoId]);

  const selected = useMemo(() => templates.find(t => t.name === selectedName), [templates, selectedName]);
  const body = selected ? bodyOf(selected) : "";
  const nVars = body ? varCount(body) : 0;

  const handleSelect = (name) => {
    setSelectedName(name);
    const t = templates.find(x => x.name === name);
    setParams(new Array(t ? varCount(bodyOf(t)) : 0).fill(""));
  };

  const preview = useMemo(() => {
    if (!body) return "";
    let out = body;
    params.forEach((v, i) => { out = out.replace(`{{${i + 1}}}`, v || `{{${i + 1}}}`); });
    return out;
  }, [body, params]);

  const handleSend = async () => {
    if (!selected) return;
    if (params.some(p => !p.trim())) return toast.error("Rellena todas las variables de la plantilla");
    setSending(true);
    try {
      await onSent({ name: selected.name, language: selected.language, params, bodyPreview: preview });
      setSelectedName("");
      setParams([]);
    } catch (err) {
      toast.error("Error enviando plantilla: " + err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="px-3 py-2.5 border-t border-border bg-card/50 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando plantillas…</div>;
  }

  if (!templates.length) {
    return (
      <div className="px-3 py-2.5 border-t border-border bg-amber-500/5 flex items-center gap-2 text-xs text-amber-500">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> No hay plantillas aprobadas para este proyecto — créalas desde YCloud/Meta antes de poder reabrir esta conversación.
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card/50 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2 text-[11px] text-amber-500">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        Han pasado más de 24h desde el último mensaje del cliente — hay que reabrir con una plantilla aprobada.
      </div>
      <select
        value={selectedName}
        onChange={e => handleSelect(e.target.value)}
        className="w-full text-sm h-9 rounded-md bg-secondary/50 border border-border px-2"
      >
        <option value="">Selecciona una plantilla…</option>
        {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
      </select>

      {selected && (
        <>
          {nVars > 0 && (
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(nVars, 2)}, 1fr)` }}>
              {params.map((v, i) => (
                <Input
                  key={i}
                  value={v}
                  onChange={e => setParams(prev => prev.map((p, idx) => idx === i ? e.target.value : p))}
                  placeholder={`Variable {{${i + 1}}}`}
                  className="h-8 text-xs bg-secondary/50"
                />
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground bg-secondary/30 rounded-md px-2.5 py-2 whitespace-pre-wrap">{preview}</p>
          <Button size="sm" className="w-full h-8" onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1.5" /> Enviar plantilla</>}
          </Button>
        </>
      )}
    </div>
  );
}
