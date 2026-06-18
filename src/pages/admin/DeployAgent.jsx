import { useState } from "react";
import { Proyecto } from "@/api/entidades";
import { api } from "@/api/backendApi";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, Rocket, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import DeployResultPanel from "@/components/admin/DeployResultPanel";

export default function DeployAgent() {
  const [selectedId, setSelectedId] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const { data: proyectos = [], isLoading } = useQuery({
    queryKey: ["admin-proyectos-activos"],
    queryFn: () => Proyecto.listAll(),
    initialData: [],
  });

  const activosProyectos = proyectos.filter(p => p.estado === "activo" || p.estado === "pro_activo");

  const handleDeploy = async () => {
    if (!selectedId) return toast.error("Selecciona un proyecto");
    setDeploying(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.generarChatbot(selectedId);
      setDeploying(false);

      if (res?.ok) {
        setResult(res);
      } else {
        setError(res?.error || "Error desconocido al generar agente");
      }
    } catch (e) {
      setError(e.message || "Error al generar agente");
      setDeploying(false);
    }
  };

  const handleReset = () => {
    setSelectedId("");
    setResult(null);
    setError(null);
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold flex items-center gap-3">
          <span>🤖</span>
          <span>Desplegar Agente <span className="text-orange-500">GenChat</span></span>
        </h1>
        <p className="text-muted-foreground mt-2">
          Genera automáticamente la configuración del agente a partir de los datos del proyecto.
        </p>
      </div>

      {/* Step 1: Select */}
      {!result && (
        <div className="rounded-2xl border border-slate-700/50 bg-[#0a0f1e] p-6 space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Paso 1 — Seleccionar proyecto activo</label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-12 bg-slate-900/60 border-slate-700 text-foreground">
                <SelectValue placeholder={isLoading ? "Cargando proyectos..." : "Selecciona un proyecto"} />
              </SelectTrigger>
              <SelectContent>
                {activosProyectos.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} — {p.url_origen}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Button */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Paso 2 — Generar configuración</label>
            <Button
              onClick={handleDeploy}
              disabled={deploying || !selectedId}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base"
            >
              {deploying ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analizando proyecto y generando configuración...</>
              ) : (
                <><Rocket className="w-5 h-5 mr-2" /> Generar configuración</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Step 3: Result */}
      {result && (
        <>
          <DeployResultPanel result={result} />
          <Button onClick={handleReset} variant="outline" className="w-full h-12 border-slate-700 text-slate-300 hover:bg-slate-800">
            <RotateCcw className="w-4 h-4 mr-2" /> Generar otro agente
          </Button>
        </>
      )}
    </div>
  );
}
