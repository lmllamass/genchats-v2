import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfigGlobal } from "@/api/entidades";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";

export default function AdminConfig() {
  const queryClient = useQueryClient();
  const [limite, setLimite] = useState(200);

  const { data: config, isLoading } = useQuery({
    queryKey: ["admin-config"],
    queryFn: () => ConfigGlobal.get(),
  });

  useEffect(() => {
    if (config) {
      setLimite(config.limite_mensajes_mes ?? 200);
    }
  }, [config]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (config?.id) {
        return ConfigGlobal.update(config.id, { limite_mensajes_mes: Number(limite) });
      }
      // If no config exists yet, nothing to do — the row should already exist as a singleton
      toast.error("No se encontró la configuración global. Contacta con el admin.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-config"] });
      toast.success("Configuración guardada");
    },
  });

  return (
    <div className="px-6 md:px-10 py-8 md:py-12 max-w-[1400px] mx-auto">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Administración</div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          <span className="gradient-text">Configuración</span>
        </h1>
        <p className="text-muted-foreground mt-2">Controles y límites globales</p>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-display font-semibold">Control de límites</h2>
            <p className="text-xs text-muted-foreground">Limita mensajes por proyecto al mes</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Límite de mensajes por proyecto/mes</Label>
            <Input
              type="number"
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
              className="mt-1 bg-secondary/50 border-border max-w-[200px]"
              min={0}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Cuando un proyecto supere este límite, el bot responderá con un mensaje de límite alcanzado.
            </p>
          </div>

          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar configuración
          </Button>
        </div>
      </div>
    </div>
  );
}
