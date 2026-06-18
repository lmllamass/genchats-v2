import { useState } from "react";
import { Copy, CheckCircle2, ChevronDown, ChevronUp, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} copiado`);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors">
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

const CHECKLIST = [
  "Crear nuevo agente en Base44 Superagent con nombre:",
  "Pegar el System Prompt",
  "Pegar el Mensaje de bienvenida",
  "Conectar WhatsApp (si el cliente lo solicitó)",
  "Conectar Telegram (si el cliente lo solicitó)",
  "Actualizar agent_name en la entidad Proyecto",
  "Verificar canales activos en el Editor del cliente",
  "Enviar email de bienvenida al cliente",
];

export default function DeployResultPanel({ result }) {
  const { agent, markdown } = result;
  const [showPrompt, setShowPrompt] = useState(false);
  const [checks, setChecks] = useState(Array(8).fill(false));

  const toggleCheck = (i) => {
    setChecks(prev => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const handleDownload = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agente_${agent.name}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Agent info card */}
      <div className="rounded-2xl border border-orange-500/40 bg-white/5 p-6 space-y-4">
        <h2 className="font-display text-xl font-bold text-orange-400 flex items-center gap-2">
          ✅ Agente generado correctamente
        </h2>

        <div className="space-y-3">
          <Row emoji="🤖" label="Nombre del agente">
            <span className="font-mono text-sm text-orange-300">{agent.name}</span>
            <CopyBtn text={agent.name} label="Agent name" />
          </Row>
          <Row emoji="🏪" label="Negocio">
            <span className="text-sm">{agent.negocio}</span>
          </Row>
          <Row emoji="🌐" label="Web">
            <a href={agent.url_origen} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline truncate">
              {agent.url_origen}
            </a>
          </Row>
          <Row emoji="✅" label="">
            <span className="text-sm text-green-400">Campo agent_name actualizado en el proyecto automáticamente</span>
          </Row>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button
          onClick={handleDownload}
          className="h-14 bg-[#0a0f1e] border border-orange-500/40 hover:bg-orange-500/10 text-orange-300 text-sm font-semibold"
        >
          <Download className="w-5 h-5 mr-2" /> Descargar instrucciones (.md)
        </Button>
        <Button
          onClick={() => setShowPrompt(!showPrompt)}
          className="h-14 bg-[#0a0f1e] border border-slate-600 hover:bg-slate-800 text-slate-300 text-sm font-semibold"
        >
          <FileText className="w-5 h-5 mr-2" />
          {showPrompt ? "Ocultar" : "📋 Ver"} System Prompt
          {showPrompt ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
        </Button>
      </div>

      {/* System prompt collapsible */}
      {showPrompt && (
        <div className="rounded-2xl border border-slate-700/50 bg-[#0a0f1e] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-lg">System Prompt</h3>
            <CopyBtn text={agent.system_prompt} label="System Prompt" />
          </div>
          <textarea
            readOnly
            value={agent.system_prompt}
            className="w-full h-72 bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 font-mono resize-none focus:outline-none"
          />
        </div>
      )}

      {/* Checklist */}
      <div className="rounded-2xl border border-slate-700/50 bg-[#0a0f1e] p-6 space-y-4">
        <h3 className="font-display font-semibold text-lg">Checklist de activación</h3>
        <div className="space-y-3">
          {CHECKLIST.map((step, i) => (
            <label key={i} className="flex items-start gap-3 cursor-pointer group" onClick={() => toggleCheck(i)}>
              <Checkbox
                checked={checks[i]}
                onCheckedChange={() => toggleCheck(i)}
                className="mt-0.5 border-slate-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
              />
              <span className={`text-sm leading-relaxed transition-colors ${checks[i] ? "text-slate-500 line-through" : "text-slate-300"}`}>
                {i + 1}. {step}
                {i === 0 && <code className="ml-1 text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded text-xs">{agent.name}</code>}
                {i === 5 && <span className="ml-1 text-green-400 text-xs">✅ Hecho</span>}
              </span>
            </label>
          ))}
        </div>
        <div className="pt-2 text-xs text-muted-foreground">
          {checks.filter(Boolean).length}/{CHECKLIST.length} pasos completados
        </div>
      </div>
    </div>
  );
}

function Row({ emoji, label, children }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-base">{emoji}</span>
      {label && <span className="text-xs text-muted-foreground min-w-[120px]">{label}:</span>}
      <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
    </div>
  );
}