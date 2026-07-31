import { useCallback, useEffect, useRef, useState } from "react";

/** Margen desde el fondo dentro del cual consideramos que el usuario "está abajo". */
const MARGEN_ABAJO = 120;

/**
 * Auto-scroll de una lista de mensajes que respeta al usuario.
 *
 * El bug que resuelve: un `useEffect` con `scrollIntoView({behavior:'smooth'})` dependiendo
 * del array de mensajes. Como el polling reemplaza el array cada 5s (identidad nueva aunque
 * el contenido sea idéntico), el efecto se disparaba constantemente y encadenaba animaciones
 * suaves que se interrumpían entre sí — la vista se movía sola y no dejaba leer nada.
 *
 * Aquí:
 *  · La dependencia es `total` (número de mensajes), nunca el array.
 *  · Se manipula `container.scrollTop` directamente en vez de `scrollIntoView`, que arrastra
 *    a todos los ancestros con overflow.
 *  · Solo baja automáticamente si el usuario ya estaba abajo; si está leyendo hacia arriba
 *    se le deja quieto y se cuentan los mensajes nuevos para ofrecer un botón.
 *
 * @param {number} total          Número de mensajes de la conversación actual.
 * @param {string|null} convKey   Identificador de la conversación: al cambiar, salto instantáneo.
 */
export function useAutoScroll(total, convKey) {
  const containerRef = useRef(null);
  const estabaAbajoRef = useRef(true);
  const ultimoTotalRef = useRef(0);
  const convAnteriorRef = useRef(convKey);
  const [noLeidos, setNoLeidos] = useState(0);

  const irAbajo = useCallback((behavior = "smooth") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    estabaAbajoRef.current = true;
    setNoLeidos(0);
  }, []);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cerca = el.scrollHeight - el.scrollTop - el.clientHeight < MARGEN_ABAJO;
    estabaAbajoRef.current = cerca;
    if (cerca) setNoLeidos(0);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const cambioConversacion = convAnteriorRef.current !== convKey;
    if (cambioConversacion) {
      convAnteriorRef.current = convKey;
      ultimoTotalRef.current = total;
      estabaAbajoRef.current = true;
      setNoLeidos(0);
      // Sin animación al cambiar de conversación: la vista debe aparecer ya al final.
      el.scrollTop = el.scrollHeight;
      return;
    }

    const nuevos = total - ultimoTotalRef.current;
    ultimoTotalRef.current = total;
    if (nuevos <= 0) return;   // el polling no ha traído nada nuevo: no tocar el scroll

    if (estabaAbajoRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      setNoLeidos(n => n + nuevos);
    }
  }, [total, convKey]);

  return { containerRef, onScroll, noLeidos, irAbajo };
}
