import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wifi, Brain } from "lucide-react";
import MaskedField from "./MaskedField";

export default function OpenAIBlock({ form, setField }) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);

  const verify = async () => {
    setVerifying(true);
    setResult(null);
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${form.openai_api_key}` }
      });
      if (res.ok) {
        setResult({ ok: true, msg: "✅ Conexión con OpenAI válida" });
      } else {
        setResult({ ok: false, msg: "❌ API Key inválida" });
      }
    } catch {
      setResult({ ok: false, msg: "❌ Error de conexión" });
    }
    setVerifying(false);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Brain className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">OpenAI</h3>
          <p className="text-[11px] text-white/40">Modelo de IA para los chatbots</p>
        </div>
      </div>

      <MaskedField label="API Key OpenAI" value={form.openai_api_key} onChange={v => setField("openai_api_key", v)} placeholder="sk-..." showCopy />

      <div>
        <label className="text-xs text-orange-300/80 mb-1 block font-medium">Modelo</label>
        <Select value={form.openai_modelo || "gpt-4o-mini"} onValueChange={v => setField("openai_modelo", v)}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white/90 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
            <SelectItem value="gpt-4o">gpt-4o</SelectItem>
            <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3">
        <Button type="button" onClick={verify} disabled={verifying || !form.openai_api_key} size="sm"
          className="bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30">
          {verifying ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wifi className="w-4 h-4 mr-1" />}
          Verificar conexión
        </Button>
      </div>
      {result && <p className={`text-sm font-medium ${result.ok ? "text-green-400" : "text-red-400"}`}>{result.msg}</p>}
    </div>
  );
}