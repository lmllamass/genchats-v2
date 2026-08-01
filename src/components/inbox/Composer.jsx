import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Loader2, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PlantillasMenu from "./PlantillasMenu";

const LINEAS_MIN = 2;
const LINEAS_MAX = 6;
const ALTO_LINEA = 20;   // px por línea, alineado con text-sm/leading-relaxed
const PADDING_V = 16;

/** Borradores por conversación. Vive fuera del componente para sobrevivir a los remounts. */
const borradores = new Map();

const esTactil = () =>
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

function restanteVentana(ultimoEntranteAt) {
  if (!ultimoEntranteAt) return null;
  const ms = 24 * 60 * 60 * 1000 - (Date.now() - new Date(ultimoEntranteAt).getTime());
  if (ms <= 0) return null;
  return { horas: Math.floor(ms / 3600000), minutos: Math.floor((ms % 3600000) / 60000) };
}

/**
 * Composer del inbox: textarea de 2 líneas con auto-crecimiento, borrador por conversación
 * y control de la ventana de 24h de WhatsApp.
 *
 * Sin <form>: el envío se maneja con onClick/onKeyDown, como el resto del proyecto.
 */
export default function Composer({
  convKey, canal, ultimoEntranteAt,
  plantillas = [], plantillasLoading = false,
  onEnviarTexto, onEnviarPlantilla,
}) {
  const [texto, setTexto] = useState(() => borradores.get(convKey) || "");
  const [enviando, setEnviando] = useState(false);
  const [, forzarTick] = useState(0);
  const textareaRef = useRef(null);

  const maxPx = LINEAS_MAX * ALTO_LINEA + PADDING_V;
  const minPx = LINEAS_MIN * ALTO_LINEA + PADDING_V;

  const ajustarAlto = useCallback((el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minPx), maxPx)}px`;
  }, [minPx, maxPx]);

  // Ref espejo: el efecto de cambio de conversación necesita leer el texto actual sin
  // volver a dispararse en cada pulsación.
  const textoRef = useRef(texto);
  useEffect(() => {
    textoRef.current = texto;
    borradores.set(convKey, texto);
  }, [texto, convKey]);

  // Cambio de conversación: guarda el borrador actual y restaura el de la nueva.
  const convAnteriorRef = useRef(convKey);
  useEffect(() => {
    const anterior = convAnteriorRef.current;
    if (anterior === convKey) return;
    if (anterior) borradores.set(anterior, textoRef.current);
    convAnteriorRef.current = convKey;
    setTexto(borradores.get(convKey) || "");
    requestAnimationFrame(() => ajustarAlto(textareaRef.current));
  }, [convKey, ajustarAlto]);

  // La cuenta atrás de la ventana se refresca cada minuto.
  const ventana = restanteVentana(ultimoEntranteAt);
  const ventanaAbierta = canal !== "whatsapp" || !!ventana;
  useEffect(() => {
    if (canal !== "whatsapp") return;
    const t = setInterval(() => forzarTick(n => n + 1), 60000);
    return () => clearInterval(t);
  }, [canal]);

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio || enviando || !ventanaAbierta) return;
    setEnviando(true);
    try {
      await onEnviarTexto(limpio);
      setTexto("");
      borradores.delete(convKey);
      requestAnimationFrame(() => ajustarAlto(textareaRef.current));
    } finally {
      setEnviando(false);
    }
  };

  const onKeyDown = (e) => {
    // En táctil Enter siempre inserta salto: el envío es solo por botón.
    if (e.key === "Enter" && !e.shiftKey && !esTactil()) {
      e.preventDefault();
      enviar();
    }
  };

  const insertarTexto = (contenido) => {
    setTexto(prev => (prev.trim() ? `${prev.trimEnd()}\n${contenido}` : contenido));
    requestAnimationFrame(() => {
      ajustarAlto(textareaRef.current);
      textareaRef.current?.focus();
    });
  };

  return (
    <div className="border-t border-border bg-card/50 flex-shrink-0">
      {/* Estado de la ventana de 24h */}
      {canal === "whatsapp" && (
        <div className="px-4 pt-2">
          {ventanaAbierta ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3 text-green-400" />
              Ventana abierta · quedan {ventana.horas} h {ventana.minutos} m
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-400">
              <Lock className="w-3 h-3" />
              Ventana cerrada · solo puedes enviar plantillas aprobadas
            </span>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-2.5">
        <PlantillasMenu
          plantillas={plantillas}
          loading={plantillasLoading}
          soloHsm={!ventanaAbierta}
          onInsertarTexto={insertarTexto}
          onEnviarHsm={onEnviarPlantilla}
          disabled={enviando}
        />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-1 min-w-0">
                <Textarea
                  ref={textareaRef}
                  value={texto}
                  onChange={e => { setTexto(e.target.value); ajustarAlto(e.target); }}
                  onKeyDown={onKeyDown}
                  rows={LINEAS_MIN}
                  disabled={enviando || !ventanaAbierta}
                  placeholder={ventanaAbierta
                    ? "Escribe un mensaje…  (Enter envía · Shift+Enter salta de línea)"
                    : "Han pasado más de 24 h desde el último mensaje del cliente"}
                  style={{ height: minPx }}
                  /* min-h-0 anula el min-h-[60px] del Textarea base, que impediría
                     que el auto-crecimiento controle la altura real. */
                  className="w-full min-h-0 bg-secondary/50 text-sm resize-none leading-relaxed disabled:opacity-60"
                />
              </div>
            </TooltipTrigger>
            {!ventanaAbierta && (
              <TooltipContent side="top" className="max-w-xs">
                WhatsApp solo permite texto libre durante las 24 h siguientes al último mensaje
                del cliente. Fuera de ese plazo, Meta exige una plantilla aprobada.
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        <Button
          type="button" onClick={enviar}
          disabled={enviando || !texto.trim() || !ventanaAbierta}
          className="shrink-0 h-11 px-5 gap-2 text-sm font-medium"
        >
          {/* Con texto, no solo icono: es la acción principal del inbox y a 36px de
              icono suelto costaba encontrarla. */}
          {enviando
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
            : <><Send className="w-4 h-4" /> Enviar</>}
        </Button>
      </div>
    </div>
  );
}
