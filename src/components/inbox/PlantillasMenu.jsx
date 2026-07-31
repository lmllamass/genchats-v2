import { useMemo, useState } from "react";
import { FileText, Search, Loader2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Sustituye {{1}}, {{2}}… por los valores introducidos, para la previsualización. */
function render(texto, valores) {
  return String(texto).replace(/\{\{(\d+)\}\}/g, (m, n) => valores[parseInt(n, 10) - 1] || m);
}

/**
 * Desplegable de plantillas del composer.
 *
 * Distingue dos cosas que no son intercambiables:
 *  · `hsm`    — plantilla aprobada por Meta. Se puede enviar SIEMPRE, incluso con la
 *               ventana de 24h cerrada. Se envía por el endpoint de plantillas.
 *  · `rapida` — respuesta predefinida local. Es texto normal, así que SOLO sirve dentro
 *               de la ventana; se inserta en el textarea para que el agente la edite.
 */
export default function PlantillasMenu({ plantillas, loading, soloHsm, onInsertarTexto, onEnviarHsm, disabled }) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [hsmElegida, setHsmElegida] = useState(null);
  const [valores, setValores] = useState([]);
  const [enviando, setEnviando] = useState(false);

  const visibles = useMemo(() => {
    const base = soloHsm ? plantillas.filter(p => p.tipo === "hsm") : plantillas;
    const q = busqueda.trim().toLowerCase();
    if (!q) return base;
    return base.filter(p =>
      p.nombre.toLowerCase().includes(q) || p.contenido.toLowerCase().includes(q));
  }, [plantillas, soloHsm, busqueda]);

  const elegir = (p) => {
    setOpen(false);
    setBusqueda("");
    if (p.tipo === "rapida") return onInsertarTexto(p.contenido);
    if (p.variables?.length) {
      setValores(new Array(Math.max(...p.variables)).fill(""));
      setHsmElegida(p);
      return;
    }
    onEnviarHsm(p, []);
  };

  const confirmarHsm = async () => {
    setEnviando(true);
    try {
      await onEnviarHsm(hsmElegida, valores);
      setHsmElegida(null);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" disabled={disabled}
            className="h-9 px-2 shrink-0 text-muted-foreground hover:text-foreground" title="Plantillas">
            <FileText className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-80 p-0">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input autoFocus value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar plantilla…" className="pl-8 h-8 text-xs bg-secondary/50" />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : visibles.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 px-3">
                {soloHsm
                  ? "No hay plantillas aprobadas para este número. Créalas desde el editor del chatbot."
                  : "No hay plantillas todavía."}
              </p>
            ) : visibles.map(p => (
              <button key={p.id} onClick={() => elegir(p)}
                className="w-full text-left px-3 py-2 hover:bg-secondary/60 transition-colors border-b border-border/40 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate flex-1">{p.nombre}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 border ${
                    p.tipo === "hsm"
                      ? "bg-violet-500/15 text-violet-400 border-violet-500/20"
                      : "bg-secondary text-muted-foreground border-border"
                  }`}>
                    {p.tipo === "hsm" ? "Plantilla" : "Rápida"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{p.contenido}</p>
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Variables de la plantilla HSM */}
      <Dialog open={!!hsmElegida} onOpenChange={o => !o && setHsmElegida(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{hsmElegida?.nombre}</DialogTitle>
            <DialogDescription>
              Rellena los valores de la plantilla. Se envía tal cual la aprobó Meta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {valores.map((v, i) => (
              <div key={i} className="space-y-1">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                  Variable {`{{${i + 1}}}`}
                </label>
                <Input value={v} placeholder={`Valor para {{${i + 1}}}`}
                  onChange={e => setValores(prev => prev.map((x, j) => (j === i ? e.target.value : x)))}
                  className="bg-secondary/50 h-9 text-sm" />
              </div>
            ))}
            <div className="rounded-lg bg-secondary/40 border border-border p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Vista previa</p>
              <p className="text-sm whitespace-pre-wrap">{render(hsmElegida?.contenido || "", valores)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHsmElegida(null)} disabled={enviando}>Cancelar</Button>
            <Button onClick={confirmarHsm} disabled={enviando || valores.some(v => !v.trim())}>
              {enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…</> : "Enviar plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
