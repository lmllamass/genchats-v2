/**
 * Cómo se llama a un interlocutor en el inbox.
 *
 * En WhatsApp/Telegram el `visitor_id` ya es un identificador legible (teléfono, usuario).
 * En una llamada es el call_id de Retell ("call_6a0fbbde…"), que no dice nada: el backend
 * resuelve el contacto real vía customer_identities y lo devuelve en `contacto`.
 */
export function etiquetaContacto(conv) {
  const c = conv?.contacto;
  if (c?.nombre) return c.nombre;
  if (c?.telefono) return c.telefono;
  if (c?.email) return c.email;
  if (conv?.canal === "phone") return "Llamada sin identificar";
  return conv?.visitor_id || "—";
}

/** Datos de contacto accionables (WhatsApp, email) que conocemos del interlocutor. */
export function datosContacto(conv) {
  const c = conv?.contacto || {};
  // En WhatsApp el propio visitor_id es el número con el que nos escribió.
  const telefono = c.telefono || (conv?.canal === "whatsapp" ? conv.visitor_id : null);
  return { telefono: telefono || null, email: c.email || null, nombre: c.nombre || null };
}
