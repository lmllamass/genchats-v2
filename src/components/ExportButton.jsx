import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/api/backendApi";

const ETIQUETAS = {
  leads: "leads",
  conversaciones: "conversaciones",
  reservas: "reservas",
};

/**
 * Botón de exportación a CSV, reutilizable en los paneles de leads,
 * conversaciones y reservas.
 *
 * `filtros` admite { desde, hasta, visitor_id } y se pasa tal cual al backend.
 */
export default function ExportButton({
  tipo,
  proyectoId,
  filtros = {},
  size = "sm",
  variant = "outline",
  className = "",
  label,
}) {
  const [exportando, setExportando] = useState(false);

  const handleExport = async () => {
    if (!proyectoId || exportando) return;
    setExportando(true);
    try {
      const nombre = await api.exportarCsv(tipo, proyectoId, filtros);
      toast.success(`Descargado ${nombre}`);
    } catch (err) {
      toast.error(err?.message || "No se pudo exportar el CSV");
    } finally {
      setExportando(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={exportando || !proyectoId}
      className={className}
      title={`Exportar ${ETIQUETAS[tipo] || tipo} a CSV (se abre con Excel)`}
    >
      {exportando ? (
        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Exportando…</>
      ) : (
        <><Download className="w-4 h-4 mr-2" /> {label || "Exportar CSV"}</>
      )}
    </Button>
  );
}
