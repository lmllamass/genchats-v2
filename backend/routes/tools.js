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

async function proyectoDelUsuario(req, res, columnas) {
  const proyectoId = req.query.proyecto_id || req.body?.proyecto_id;
  if (!proyectoId) {
    res.status(400).json({ error: 'proyecto_id es obligatorio' });
    return null;
  }
  const proyecto = await projectForUser(proyectoId, req.user.id,
    columnas ? { columns: columnas } : {});
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

// ── El portal de archivos ───────────────────────────────────────────────────
//
// No es una herramienta del agente: es la configuración de la pantalla donde el
// cliente final sube sus documentos. Por eso va aparte y no en el catálogo.

const SLOTS_POR_DEFECTO = [
  { id: 'dni_anverso', titulo: 'DNI o NIE — parte delantera', ayuda: 'Que se vean las cuatro esquinas, sin reflejos.' },
  { id: 'dni_reverso', titulo: 'DNI o NIE — parte trasera',   ayuda: 'La cara de atrás del documento.' },
  { id: 'foto_carnet', titulo: 'Fotografía tipo carnet',      ayuda: 'De frente y sobre fondo claro. Vale un selfie bien iluminado.' },
];

router.get('/portal', async (req, res) => {
  // chatbot_config trae la URL de la política, que se enseña aquí sin volver a pedirla.
  const proyecto = await proyectoDelUsuario(req, res, 'id, nombre, user_id, chatbot_config');
  if (!proyecto) return;

  const { data } = await supabase
    .from('project_tools').select('config')
    .eq('project_id', proyecto.id).eq('tool_name', 'archivos').maybeSingle();

  const cfg = data?.config || {};
  res.json({
    slots: Array.isArray(cfg.slots) && cfg.slots.length ? cfg.slots : SLOTS_POR_DEFECTO,
    usando_por_defecto: !(Array.isArray(cfg.slots) && cfg.slots.length),
    dias_validez: cfg.dias_validez || 7,
    aviso_privacidad: cfg.aviso_privacidad || '',
    // La política sale de la configuración del chatbot, que es donde el tenant
    // la edita; aquí solo se dice si la tiene, para no pedirla dos veces.
    url_privacidad: (proyecto.chatbot_config?.url_privacidad || '').trim(),
  });
});

router.put('/portal', express.json(), async (req, res) => {
  const proyecto = await proyectoDelUsuario(req, res);
  if (!proyecto) return;

  const { slots, dias_validez, aviso_privacidad } = req.body || {};

  const { data: fila } = await supabase
    .from('project_tools').select('config')
    .eq('project_id', proyecto.id).eq('tool_name', 'archivos').maybeSingle();

  const config = { ...(fila?.config || {}) };

  if (slots !== undefined) {
    if (!Array.isArray(slots)) return res.status(400).json({ error: 'slots debe ser una lista' });
    const limpios = slots.map(saneaSlot).filter(Boolean);
    if (!limpios.length) return res.status(400).json({ error: 'Pide al menos un documento' });
    // El id identifica el fichero en el almacenamiento: dos iguales se pisarían.
    const ids = new Set(limpios.map(s => s.id));
    if (ids.size !== limpios.length) {
      return res.status(400).json({ error: 'Hay dos documentos con el mismo nombre' });
    }
    config.slots = limpios;
  }
  if (dias_validez !== undefined) {
    const n = parseInt(dias_validez, 10);
    if (!Number.isFinite(n) || n < 1 || n > 90) {
      return res.status(400).json({ error: 'La caducidad va de 1 a 90 días' });
    }
    config.dias_validez = n;
  }
  if (aviso_privacidad !== undefined) config.aviso_privacidad = String(aviso_privacidad).trim();

  const { error } = await supabase
    .from('project_tools')
    .upsert({ project_id: proyecto.id, tool_name: 'archivos', enabled: true, config },
            { onConflict: 'project_id,tool_name' });

  if (error) {
    console.error('[tools] portal:', error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true, config });
});

/**
 * El `id` acaba siendo el nombre del fichero en el almacenamiento, así que se
 * deriva del título y se limpia. Si alguien pide "Póliza del seguro", el fichero
 * será `poliza_del_seguro.jpg` y no algo con acentos o espacios.
 */
function saneaSlot(s) {
  const titulo = String(s?.titulo || '').trim();
  if (!titulo) return null;
  const id = String(s?.id || titulo)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, 40);
  if (!id) return null;
  return { id, titulo, ayuda: String(s?.ayuda || '').trim() };
}

export default router;
