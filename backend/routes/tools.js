/**
 * tools.js — las acciones del agente, editables por el propio tenant.
 *
 * Hasta ahora `project_tools` solo se tocaba con scripts o desde el admin de
 * plataforma: cada cliente nuevo necesitaba que alguien de dentro le montara el
 * flujo a mano. Esto es lo que faltaba para que se valga solo.
 *
 * La tabla tiene RLS cerrada a service_role, así que todo pasa por aquí
 * comprobando que el proyecto es suyo.
 */
import express from 'express';
import { supabase } from '../server.js';
import { projectForUser } from '../lib/projectAccess.js';

const router = express.Router();

/**
 * Catálogo de lo que se puede activar. La descripción es la que se le enseña al
 * TENANT, no la que ve el modelo: aquí importa que entienda qué gana
 * activándolo, no cómo se invoca.
 */
const CATALOGO = [
  { nombre: 'custom', titulo: 'Acciones a medida', grupo: 'Automatización',
    resumen: 'Las que tú definas abajo. Cada una llama a tu flujo de n8n con los datos que le pidas al cliente.' },
  { nombre: 'concertar_cita', titulo: 'Concertar cita', grupo: 'Agenda',
    resumen: 'El agente toma una cita y la registra. Si hay Google Calendar conectado, crea el evento.' },
  { nombre: 'consultar_disponibilidad', titulo: 'Consultar disponibilidad', grupo: 'Agenda',
    resumen: 'Ofrece huecos reales de tus sedes y horarios. Sin esto, el agente no puede dar fechas.' },
  { nombre: 'reservar_plaza', titulo: 'Reservar plaza', grupo: 'Agenda',
    resumen: 'Confirma la reserva y le da el código al cliente. Úsalo junto al anterior.' },
  { nombre: 'gestionar_reserva', titulo: 'Cambiar o cancelar reserva', grupo: 'Agenda',
    resumen: 'El cliente puede consultar, mover o cancelar lo que ya tiene. La busca por su teléfono si no recuerda el código.' },
  { nombre: 'capturar_pedido', titulo: 'Tomar pedidos', grupo: 'Ventas',
    resumen: 'Registra un pedido con los productos y los datos de entrega.' },
  { nombre: 'consultar_stock', titulo: 'Consultar stock', grupo: 'Ventas',
    resumen: 'Comprueba existencias en tiempo real antes de prometer nada.' },
  { nombre: 'enviar_whatsapp', titulo: 'Enviar WhatsApp', grupo: 'Mensajería',
    resumen: 'Manda por escrito lo que no cabe en una llamada: enlaces, direcciones, resúmenes.' },
  { nombre: 'enviar_email', titulo: 'Enviar email', grupo: 'Mensajería',
    resumen: 'Alternativa cuando el WhatsApp falla o el cliente lo prefiere.' },
  { nombre: 'desviar_llamada', titulo: 'Pasar la llamada a una persona', grupo: 'Voz',
    resumen: 'Solo por teléfono. Transfiere al número del negocio cuando el cliente lo pide o se atasca.' },
];

/** Filas que NO son herramientas del agente, sino configuración de otras partes. */
const NO_SON_HERRAMIENTAS = new Set(['archivos', 'documentos']);

async function proyectoDelUsuario(req, res) {
  const proyectoId = req.query.proyecto_id || req.body?.proyecto_id;
  if (!proyectoId) {
    res.status(400).json({ error: 'proyecto_id es obligatorio' });
    return null;
  }
  const proyecto = await projectForUser(proyectoId, req.user.id);
  if (!proyecto) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return proyecto;
}

// GET /api/tools?proyecto_id=X — catálogo + lo que tiene configurado
router.get('/', async (req, res) => {
  const proyecto = await proyectoDelUsuario(req, res);
  if (!proyecto) return;

  const { data } = await supabase
    .from('project_tools')
    .select('id, tool_name, enabled, config')
    .eq('project_id', proyecto.id);

  const porNombre = Object.fromEntries((data || []).map(f => [f.tool_name, f]));

  res.json({
    // El webhook de acciones es global de la plataforma, no del proyecto: si no
    // está puesto, ninguna acción llega a n8n y conviene decirlo en pantalla.
    webhook_configurado: !!process.env.N8N_ACTIONS_WEBHOOK_URL,
    herramientas: CATALOGO.map(t => ({
      ...t,
      id: porNombre[t.nombre]?.id || null,
      enabled: porNombre[t.nombre]?.enabled || false,
      config: porNombre[t.nombre]?.config || {},
    })),
    // Filas que existen en la base pero no están en el catálogo: no se pierden
    // de vista, pero tampoco se presentan como algo que activar.
    otras: (data || [])
      .filter(f => !CATALOGO.some(t => t.nombre === f.tool_name) && !NO_SON_HERRAMIENTAS.has(f.tool_name))
      .map(f => f.tool_name),
  });
});

// PUT /api/tools — activa/desactiva y guarda la configuración de una herramienta
router.put('/', express.json(), async (req, res) => {
  const proyecto = await proyectoDelUsuario(req, res);
  if (!proyecto) return;

  const { tool_name, enabled, config } = req.body || {};
  if (!tool_name) return res.status(400).json({ error: 'tool_name es obligatorio' });
  if (!CATALOGO.some(t => t.nombre === tool_name)) {
    return res.status(400).json({ error: 'Esa herramienta no existe' });
  }

  const fila = { project_id: proyecto.id, tool_name };
  if (enabled !== undefined) fila.enabled = !!enabled;
  if (config !== undefined) {
    if (typeof config !== 'object' || Array.isArray(config)) {
      return res.status(400).json({ error: 'La configuración debe ser un objeto' });
    }
    fila.config = tool_name === 'custom' ? saneaCustom(config) : config;
  }

  const { data, error } = await supabase
    .from('project_tools')
    .upsert(fila, { onConflict: 'project_id,tool_name' })
    .select('id, tool_name, enabled, config')
    .single();

  if (error) {
    console.error('[tools] guardar:', error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json({ herramienta: data });
});

/**
 * Las acciones de `custom` son lo que acaba en el ESQUEMA que ve el modelo, así
 * que un nombre con espacios o una descripción vacía no son un detalle estético:
 * rompen la llamada. Se sanean aquí y no en el navegador.
 */
function saneaCustom(config) {
  const acciones = Array.isArray(config.acciones) ? config.acciones : [];
  return {
    ...config,
    acciones: acciones
      .map(a => ({
        // minúsculas y guiones bajos: es un identificador, no un título
        nombre: String(a.nombre || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, ''),
        descripcion: String(a.descripcion || '').trim(),
        datos: String(a.datos || '').trim(),
      }))
      .filter(a => a.nombre && a.descripcion),
  };
}

export default router;
