/**
 * archivosContacto.js — pestaña Archivos de la ficha del contacto.
 *
 * Va montado sobre /api/conversations y usa el mismo id compuesto que el resto
 * del panel ("proyecto~canal~visitor"), pero los archivos NO cuelgan de la
 * conversación: cuelgan del contacto. Aquí se resuelve uno a partir del otro,
 * así el panel no tiene que saber nada de la capa de identidad omnicanal y los
 * ficheros de un mismo cliente son los mismos se abra el chat que se abra.
 *
 * Rutas (todas bajo /api/conversations/:id/archivos):
 *   GET    /                     lista archivos y enlaces del contacto
 *   POST   /                     el tenant sube un fichero (binario crudo)
 *   DELETE /:archivoId           borra fichero y objeto
 *   GET    /:archivoId/descargar redirige a una URL firmada
 *   POST   /enlaces              crea un magic link para el contacto
 *   DELETE /enlaces/:enlaceId    lo revoca
 */
import express from 'express';
import { supabase } from '../server.js';
import { projectForUser } from '../lib/projectAccess.js';
import { crearEnlace, revocarEnlace } from '../lib/archivoEnlaces.js';

const router = express.Router();
const BUCKET = 'archivos';
const TAM_MAXIMO = 25 * 1024 * 1024;
const SEGUNDOS_DESCARGA = 300;

function decodeId(id) {
  const p = id.indexOf('~');
  const s = id.indexOf('~', p + 1);
  return { proyecto_id: id.slice(0, p), canal: id.slice(p + 1, s), visitor_id: id.slice(s + 1) };
}

function nombreSeguro(valor, porDefecto = 'archivo') {
  const limpio = String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 80);
  return limpio.replace(/^[._]+/, '') || porDefecto;
}

/**
 * Contacto detrás de una conversación del panel.
 *
 * `customer_conversations` guarda el hilo por canal; el visitor_id del panel es
 * su `channel_thread_id` (y en los hilos antiguos, `legacy_visitor_id`). En voz
 * el visitor_id es el call_id de Retell, que se resuelve por identidad.
 */
async function contactoDeConversacion({ proyecto_id, canal, visitor_id }) {
  // Dos consultas en vez de un .or(): el filtro `or` se construye interpolando
  // en una cadena, y visitor_id viene de la URL — una coma o un paréntesis ahí
  // alteraría el filtro. Con .eq() el valor va parametrizado.
  const busca = campo => supabase
    .from('customer_conversations')
    .select('customer_id')
    .eq('proyecto_id', proyecto_id)
    .eq(campo, visitor_id)
    .limit(1);

  const [{ data: porHilo }, { data: porLegado }] = await Promise.all([
    busca('channel_thread_id'),
    busca('legacy_visitor_id'),
  ]);
  const encontrado = porHilo?.[0]?.customer_id || porLegado?.[0]?.customer_id;
  if (encontrado) return encontrado;

  const { data: porIdentidad } = await supabase
    .from('customer_identities')
    .select('customer_id')
    .eq('proyecto_id', proyecto_id)
    .eq('normalized_value', visitor_id)
    .limit(1);
  return porIdentidad?.[0]?.customer_id || null;
}

/** Middleware: comprueba propiedad del proyecto y resuelve el contacto. */
async function conContacto(req, res, next) {
  try {
    const { proyecto_id, canal, visitor_id } = decodeId(req.params.id);
    const proyecto = await projectForUser(proyecto_id, req.user.id);
    if (!proyecto) return res.status(403).json({ error: 'Forbidden' });

    const customerId = await contactoDeConversacion({ proyecto_id, canal, visitor_id });
    req.ficha = { proyectoId: proyecto_id, customerId, carpeta: `${proyecto_id}/${customerId}` };
    next();
  } catch (err) {
    console.error('[archivos-contacto]', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ── Listado ─────────────────────────────────────────────────────────────────
router.get('/:id/archivos', conContacto, async (req, res) => {
  const { proyectoId, customerId } = req.ficha;
  // Sin contacto todavía (conversación anónima que nunca dejó datos) no es un
  // error: simplemente aún no hay dónde colgar los ficheros.
  if (!customerId) return res.json({ sin_contacto: true, archivos: [], enlaces: [] });

  const [{ data: archivos }, { data: enlaces }] = await Promise.all([
    supabase.from('archivos')
      .select('id, nombre, mime, bytes, origen, slot, created_at')
      .eq('proyecto_id', proyectoId).eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase.from('archivo_enlaces')
      .select('id, permisos, expira_en, revocado_en, usos, ultimo_uso_en, created_at')
      .eq('proyecto_id', proyectoId).eq('customer_id', customerId)
      .order('created_at', { ascending: false }).limit(10),
  ]);

  res.json({ customer_id: customerId, archivos: archivos || [], enlaces: enlaces || [] });
});

// ── El tenant sube un fichero ───────────────────────────────────────────────
router.post('/:id/archivos', conContacto,
  express.raw({ type: () => true, limit: TAM_MAXIMO }),
  async (req, res) => {
    const { proyectoId, customerId, carpeta } = req.ficha;
    if (!customerId) return res.status(409).json({ error: 'Esta conversación aún no tiene contacto asociado' });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Fichero vacío' });
    }

    const nombre = req.get('x-nombre-archivo')
      ? nombreSeguro(decodeURIComponent(req.get('x-nombre-archivo')))
      : 'archivo';
    const mime = (req.get('content-type') || 'application/octet-stream').split(';')[0];
    // Se antepone la marca de tiempo para que dos ficheros con el mismo nombre
    // no se pisen: la ruta es única en la tabla.
    const ruta = `${carpeta}/${Date.now()}-${nombre}`;

    // La fila primero: es la que dispara el trigger de cuota.
    const { data: fila, error: errorFila } = await supabase
      .from('archivos')
      .insert({
        proyecto_id: proyectoId, customer_id: customerId, ruta,
        nombre, mime, bytes: req.body.length,
        origen: 'tenant', subido_por: req.user.id,
      })
      .select('id, nombre, mime, bytes, origen, slot, created_at')
      .single();

    if (errorFila) {
      const lleno = /almacenamiento de tu plan/i.test(errorFila.message);
      console.error('[archivos-contacto] alta:', errorFila.message);
      return res.status(lleno ? 507 : 500).json({
        error: lleno ? errorFila.message : 'No se ha podido guardar el archivo',
      });
    }

    const { error: errorSubida } = await supabase.storage
      .from(BUCKET).upload(ruta, req.body, { contentType: mime, upsert: false });

    if (errorSubida) {
      await supabase.from('archivos').delete().eq('id', fila.id);
      console.error('[archivos-contacto] storage:', errorSubida.message);
      return res.status(500).json({ error: 'No se ha podido guardar el archivo' });
    }

    res.json({ ok: true, archivo: fila });
  });

// ── Descargar ───────────────────────────────────────────────────────────────
router.get('/:id/archivos/:archivoId/descargar', conContacto, async (req, res) => {
  const { proyectoId, customerId } = req.ficha;
  const { data: archivo } = await supabase
    .from('archivos').select('ruta, nombre')
    .eq('id', req.params.archivoId)
    .eq('proyecto_id', proyectoId).eq('customer_id', customerId)
    .maybeSingle();
  if (!archivo) return res.status(404).json({ error: 'No encontrado' });

  // Siempre como adjunto: lo que sube un contacto puede ser un HTML o un SVG
  // con script, y servirlo con su propio tipo sería XSS con la sesión abierta.
  const { data, error } = await supabase.storage
    .from(BUCKET).createSignedUrl(archivo.ruta, SEGUNDOS_DESCARGA, { download: archivo.nombre });
  if (error || !data?.signedUrl) return res.status(500).json({ error: 'No se pudo firmar la descarga' });

  res.json({ url: data.signedUrl });
});

// ── Borrar ──────────────────────────────────────────────────────────────────
router.delete('/:id/archivos/:archivoId', conContacto, async (req, res) => {
  const { proyectoId, customerId } = req.ficha;
  const { data: archivo } = await supabase
    .from('archivos').select('id, ruta')
    .eq('id', req.params.archivoId)
    .eq('proyecto_id', proyectoId).eq('customer_id', customerId)
    .maybeSingle();
  if (!archivo) return res.status(404).json({ error: 'No encontrado' });

  // El objeto primero: si falla el borrado de la fila quedaría un enlace a un
  // objeto que ya no está, que es menos malo que un objeto que nadie ve pero
  // sigue ocupando cuota.
  await supabase.storage.from(BUCKET).remove([archivo.ruta]);
  const { error } = await supabase.from('archivos').delete().eq('id', archivo.id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});

// ── Enlaces ─────────────────────────────────────────────────────────────────
router.post('/:id/archivos/enlaces', express.json(), conContacto, async (req, res) => {
  const { proyectoId, customerId } = req.ficha;
  if (!customerId) return res.status(409).json({ error: 'Esta conversación aún no tiene contacto asociado' });

  try {
    const { permisos, dias_validez } = req.body || {};
    const { data: fila } = await supabase.from('project_tools').select('config')
      .eq('project_id', proyectoId).eq('tool_name', 'archivos').maybeSingle();

    const { token, enlace } = await crearEnlace(supabase, {
      proyectoId,
      customerId,
      permisos: Array.isArray(permisos) && permisos.length ? permisos : ['subir'],
      slots: fila?.config?.slots || [],
      diasValidez: dias_validez || fila?.config?.dias_validez || 7,
      creadoPor: req.user.id,
    });

    const base = process.env.DOCS_PUBLIC_URL || process.env.API_PUBLIC_URL || '';
    res.json({ ok: true, url: `${base}/p/${token}`, enlace });
  } catch (err) {
    console.error('[archivos-contacto] enlace:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/archivos/enlaces/:enlaceId', conContacto, async (req, res) => {
  const ok = await revocarEnlace(supabase, {
    proyectoId: req.ficha.proyectoId,
    enlaceId: req.params.enlaceId,
  });
  res.status(ok ? 200 : 500).json({ ok });
});

export default router;
