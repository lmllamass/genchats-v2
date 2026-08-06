/**
 * archivos.js — portal de cargas y descargas del cliente final.
 *
 * Un mini-portal por contacto: el tenant le deja archivos (presupuestos,
 * facturas, diplomas) y él sube los suyos (DNI, documentación, fotos). Como los
 * contactos ya están unificados por la identidad omnicanal, lo que sube aquí
 * aparece en la misma ficha que sus WhatsApps.
 *
 * Entra por un magic link, sin cuenta ni contraseña: crear usuarios para los
 * clientes de nuestros clientes mata la adopción.
 *
 * Rutas:
 *   POST /api/archivos/enlace          (n8n o el panel → crea el magic link)
 *   GET  /p/:token                     (el contacto → portal)
 *   GET  /p/:token/estado              (qué lleva subido y qué puede descargar)
 *   PUT  /p/:token/subir/:slot         (sube un fichero, binario crudo)
 *   GET  /p/:token/bajar/:archivoId    (descarga, redirige a URL firmada)
 *   POST /p/:token/finalizar           (avisa al webhook del proyecto)
 */
import express from 'express';
import { supabase } from '../server.js';
import { crearEnlace, resolverEnlace, anotarUso } from '../lib/archivoEnlaces.js';

const router = express.Router();
const BUCKET = 'archivos';

const SLOTS_POR_DEFECTO = [
  { id: 'dni_anverso', titulo: 'DNI o NIE — parte delantera', ayuda: 'Que se vean las cuatro esquinas, sin reflejos.' },
  { id: 'dni_reverso', titulo: 'DNI o NIE — parte trasera',   ayuda: 'La cara de atrás del documento.' },
  { id: 'foto_carnet', titulo: 'Fotografía tipo carnet',      ayuda: 'De frente y sobre fondo claro. Vale un selfie bien iluminado.' },
];

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const TAM_MAXIMO = 25 * 1024 * 1024;   // el mismo límite que tiene el bucket
const SEGUNDOS_DESCARGA = 300;

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Nunca se construyen rutas con texto libre del visitante. */
function trozoSeguro(valor) {
  return String(valor || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 60);
}

const puede = (enlace, permiso) => Array.isArray(enlace.permisos) && enlace.permisos.includes(permiso);

async function cargarConfig(proyectoId) {
  const [{ data: proyecto }, { data: fila }] = await Promise.all([
    supabase.from('proyectos').select('id, nombre, chatbot_config').eq('id', proyectoId).single(),
    supabase.from('project_tools').select('config')
      .eq('project_id', proyectoId).eq('tool_name', 'archivos').maybeSingle(),
  ]);
  if (!proyecto) return null;

  const chat = proyecto.chatbot_config || {};
  const cfg = fila?.config || {};
  return {
    marca: {
      nombre: chat.nombre_negocio || proyecto.nombre,
      logo: chat.logo_url || '',
      color: chat.color_primario || '#6366f1',
    },
    slotsPorDefecto: Array.isArray(cfg.slots) && cfg.slots.length ? cfg.slots : SLOTS_POR_DEFECTO,
    webhookConfirmacion: cfg.webhook_confirmacion || '',
    diasValidez: cfg.dias_validez || 7,
    avisoPrivacidad: cfg.aviso_privacidad
      || 'Los archivos se usan únicamente para gestionar tu solicitud y se conservan el tiempo '
       + 'imprescindible. Puedes ejercer tus derechos de acceso y supresión escribiendo al negocio.',
  };
}

/** Middleware: resuelve el magic link y deja el contexto en req.portal. */
async function conEnlace(req, res, next) {
  const enlace = await resolverEnlace(supabase, req.params.token);
  if (!enlace) {
    // Caducado, revocado o inexistente se tratan igual: nunca se le dice al
    // visitante cuál de las tres cosas es.
    if (req.method !== 'GET') return res.status(410).json({ error: 'Enlace no válido' });
    return res.status(410).type('html').send(paginaError(
      'Enlace no válido o caducado',
      'Por seguridad estos enlaces caducan. Pide uno nuevo por el chat y te lo enviamos al momento.'));
  }

  const config = await cargarConfig(enlace.proyecto_id);
  if (!config) return res.status(404).json({ error: 'No encontrado' });

  const { data: contacto } = await supabase
    .from('customers').select('id, display_name').eq('id', enlace.customer_id).single();

  const slots = Array.isArray(enlace.slots) && enlace.slots.length
    ? enlace.slots : config.slotsPorDefecto;

  req.portal = {
    enlace, config, contacto, slots,
    carpeta: `${enlace.proyecto_id}/${enlace.customer_id}`,
  };
  next();
}

// ── Crear el enlace ─────────────────────────────────────────────────────────
router.post('/api/archivos/enlace', express.json(), async (req, res) => {
  try {
    if (!process.env.DOCS_WEBHOOK_SECRET
      || req.headers['x-docs-secret'] !== process.env.DOCS_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const { proyecto_id, customer_id, permisos, slots, dias_validez, metadata } = req.body || {};
    if (!proyecto_id || !customer_id) {
      return res.status(400).json({ error: 'proyecto_id y customer_id son obligatorios' });
    }

    const config = await cargarConfig(proyecto_id);
    if (!config) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const { token, enlace } = await crearEnlace(supabase, {
      proyectoId: proyecto_id,
      customerId: customer_id,
      permisos: Array.isArray(permisos) && permisos.length ? permisos : ['subir'],
      slots: Array.isArray(slots) && slots.length ? slots : config.slotsPorDefecto,
      diasValidez: dias_validez || config.diasValidez,
      metadata: metadata || {},
    });

    const base = process.env.DOCS_PUBLIC_URL || `https://${req.get('host')}`;
    res.json({
      ok: true,
      url: `${base}/p/${token}`,
      enlace_id: enlace.id,
      expira_en: enlace.expira_en,
      documentos: (enlace.slots || []).map(s => s.titulo),
    });
  } catch (err) {
    console.error('[archivos] enlace:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── El contacto abre el portal ──────────────────────────────────────────────
router.get('/p/:token', conEnlace, (req, res) => {
  anotarUso(supabase, req.portal.enlace.id);
  res.type('html').send(paginaPortal(req.portal));
});

router.get('/p/:token/estado', conEnlace, async (req, res) => {
  const { enlace, slots } = req.portal;
  const { data } = await supabase
    .from('archivos')
    .select('id, nombre, slot, bytes, mime, origen, created_at')
    .eq('proyecto_id', enlace.proyecto_id)
    .eq('customer_id', enlace.customer_id)
    .order('created_at', { ascending: false });

  const archivos = data || [];
  const idsSlots = new Set(slots.map(s => s.id));
  res.json({
    subidos: archivos.filter(a => a.slot && idsSlots.has(a.slot)).map(a => a.slot),
    // Para descargar solo se ofrece lo que dejó el negocio, nunca lo que subió
    // él ni lo que llegó por otros canales.
    descargas: puede(enlace, 'descargar')
      ? archivos.filter(a => a.origen === 'tenant')
        .map(a => ({ id: a.id, nombre: a.nombre, bytes: a.bytes, fecha: a.created_at }))
      : [],
  });
});

router.put('/p/:token/subir/:slot', conEnlace,
  express.raw({ type: () => true, limit: TAM_MAXIMO }),
  async (req, res) => {
    const { enlace, slots, carpeta } = req.portal;
    if (!puede(enlace, 'subir')) return res.status(403).json({ error: 'Este enlace no permite subir' });

    const slot = slots.find(s => s.id === req.params.slot);
    if (!slot) return res.status(400).json({ error: 'Documento no reconocido' });

    const mime = (req.get('content-type') || '').split(';')[0].toLowerCase();
    if (!TIPOS_PERMITIDOS.includes(mime)) {
      return res.status(415).json({ error: 'Formato no admitido. Envía una foto o un PDF.' });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Fichero vacío' });
    }

    const ext = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1].replace('jpeg', 'jpg');
    const ruta = `${carpeta}/${trozoSeguro(slot.id)}.${ext}`;

    // La fila va PRIMERO: es la que dispara el trigger de cuota. Al revés
    // dejaríamos el objeto subido y huérfano cuando el plan está lleno.
    const { data: fila, error: errorFila } = await supabase
      .from('archivos')
      .upsert({
        proyecto_id: enlace.proyecto_id,
        customer_id: enlace.customer_id,
        ruta,
        nombre: slot.titulo || slot.id,
        mime,
        bytes: req.body.length,
        origen: 'portal',
        slot: slot.id,
        metadata: { enlace_id: enlace.id },
      }, { onConflict: 'ruta' })
      .select('id')
      .single();

    if (errorFila) {
      const lleno = /almacenamiento de tu plan/i.test(errorFila.message);
      console.error('[archivos] alta:', errorFila.message);
      return res.status(lleno ? 507 : 500).json({
        error: lleno
          ? 'El negocio ha agotado su espacio de almacenamiento. Avísale, por favor.'
          : 'No se ha podido guardar. Inténtalo otra vez.',
      });
    }

    const { error: errorSubida } = await supabase.storage
      .from(BUCKET).upload(ruta, req.body, { contentType: mime, upsert: true });

    if (errorSubida) {
      await supabase.from('archivos').delete().eq('id', fila.id);
      console.error('[archivos] storage:', errorSubida.message);
      return res.status(500).json({ error: 'No se ha podido guardar. Inténtalo otra vez.' });
    }

    console.log(`[archivos] ${carpeta} · ${slot.id} · ${(req.body.length / 1024).toFixed(0)} KB`);
    res.json({ ok: true, slot: slot.id });
  });

router.get('/p/:token/bajar/:archivoId', conEnlace, async (req, res) => {
  const { enlace } = req.portal;
  if (!puede(enlace, 'descargar')) return res.status(403).json({ error: 'Este enlace no permite descargar' });

  // Se filtra también por contacto: el id de un archivo de otra persona no vale.
  const { data: archivo } = await supabase
    .from('archivos').select('ruta, nombre, origen')
    .eq('id', req.params.archivoId)
    .eq('proyecto_id', enlace.proyecto_id)
    .eq('customer_id', enlace.customer_id)
    .maybeSingle();

  if (!archivo || archivo.origen !== 'tenant') return res.status(404).json({ error: 'No encontrado' });

  // `download` fuerza Content-Disposition: attachment. Es lo que impide que un
  // HTML o un SVG subido por un tercero acabe ejecutándose en nuestro dominio.
  const { data, error } = await supabase.storage
    .from(BUCKET).createSignedUrl(archivo.ruta, SEGUNDOS_DESCARGA, { download: archivo.nombre });

  if (error || !data?.signedUrl) {
    console.error('[archivos] firma:', error?.message);
    return res.status(500).json({ error: 'No se ha podido preparar la descarga' });
  }
  res.redirect(data.signedUrl);
});

router.post('/p/:token/finalizar', express.json(), conEnlace, (req, res) => {
  const { enlace, config, carpeta } = req.portal;
  if (config.webhookConfirmacion) {
    // Si el aviso falla, el contacto no tiene la culpa: sus ficheros ya están
    // guardados, así que se le confirma igual y el fallo queda en el log.
    fetch(config.webhookConfirmacion, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evento: 'archivos_recibidos',
        proyecto_id: enlace.proyecto_id,
        customer_id: enlace.customer_id,
        carpeta,
        recibido_en: new Date().toISOString(),
        ...(enlace.metadata || {}),
      }),
    }).catch(err => console.error('[archivos] webhook:', err.message));
  }
  res.json({ ok: true });
});

// ── Páginas ─────────────────────────────────────────────────────────────────

function envoltorio(titulo, color, cuerpo) {
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${esc(titulo)}</title>
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
       background:#f4f5f7;color:#1a1d23;padding:0 0 40px}
  .cab{background:${color};color:#fff;padding:22px 20px}
  .cab img{max-height:38px;margin-bottom:10px;display:block}
  .cab h1{margin:0;font-size:19px;font-weight:650}
  .cab p{margin:4px 0 0;opacity:.9;font-size:14px}
  .env{max-width:560px;margin:0 auto;padding:0 16px}
  h3{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;margin:22px 0 8px}
  .ficha{background:#fff;border-radius:12px;padding:14px 16px;margin:16px 0;
         box-shadow:0 1px 3px rgba(0,0,0,.08);font-size:14px}
  .ficha b{display:block;font-size:16px;margin-bottom:2px}
  .ficha span{color:#5b6472}
  .doc{background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;
       box-shadow:0 1px 3px rgba(0,0,0,.08);display:flex;gap:14px;align-items:center;
       color:inherit;text-decoration:none}
  .doc h2{margin:0 0 2px;font-size:15px;font-weight:600}
  .doc p{margin:0;font-size:13px;color:#5b6472}
  .doc .txt{flex:1;min-width:0}
  .mini{width:56px;height:56px;border-radius:9px;object-fit:cover;flex-shrink:0;display:none}
  .estado{width:56px;height:56px;border-radius:9px;flex-shrink:0;display:flex;
          align-items:center;justify-content:center;font-size:24px;background:#eef0f4;color:#96a0ae}
  .doc.ok .estado{background:#e7f7ed;color:#1a9c4b}
  .doc.ok{border:1px solid #bfe8cd}
  .doc.error .estado{background:#fdecec;color:#d33}
  .aviso{font-size:12px;color:#6b7280;margin:20px 0 0;line-height:1.5}
  .fin{background:#fff;border-radius:12px;padding:28px 20px;text-align:center;
       box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .fin .tick{font-size:46px;line-height:1}
  .fin h2{margin:10px 0 6px;font-size:19px}
  .fin p{margin:0;color:#5b6472;font-size:14px}
  input[type=file]{display:none}
</style>
</head><body>${cuerpo}</body></html>`;
}

function paginaError(titulo, texto) {
  return envoltorio(titulo, '#6b7280', `
<div class="cab"><h1>${esc(titulo)}</h1></div>
<div class="env"><div class="ficha"><span>${esc(texto)}</span></div></div>`);
}

function paginaPortal({ enlace, config, contacto, slots }) {
  const { marca, avisoPrivacidad } = config;
  const puedeSubir = puede(enlace, 'subir');
  const puedeBajar = puede(enlace, 'descargar');

  const tarjetas = slots.map(s => `
  <div class="doc" id="doc-${esc(s.id)}" data-slot="${esc(s.id)}">
    <div class="estado">+</div>
    <img class="mini" alt="">
    <div class="txt">
      <h2>${esc(s.titulo)}</h2>
      <p>${esc(s.ayuda || '')}</p>
    </div>
  </div>
  <input type="file" id="in-${esc(s.id)}" accept="image/*,application/pdf" capture="environment">`).join('');

  const intro = puedeSubir && puedeBajar
    ? 'Aquí puedes subir tu documentación y descargar la que te hemos dejado.'
    : puedeBajar
      ? 'Aquí tienes los documentos que te hemos dejado.'
      : 'Sube aquí la documentación que te hemos pedido.';

  return envoltorio(`Tus archivos · ${marca.nombre}`, marca.color, `
<div class="cab">
  ${marca.logo ? `<img src="${esc(marca.logo)}" alt="${esc(marca.nombre)}">` : ''}
  <h1>${esc(marca.nombre)}</h1>
  <p>Tus archivos</p>
</div>
<div class="env">
  <div class="ficha">
    <b>${esc(contacto?.display_name || 'Hola')}</b>
    <span>${esc(intro)}</span>
  </div>

  ${puedeBajar ? '<div id="zona-descargas"></div>' : ''}
  ${puedeSubir ? `<h3>Lo que necesitamos de ti</h3><div id="lista">${tarjetas}</div>` : ''}

  <p class="aviso">${esc(avisoPrivacidad)}</p>
</div>
<script>
const SLOTS = ${JSON.stringify(puedeSubir ? slots.map(s => s.id) : [])};
const PUEDE_BAJAR = ${puedeBajar};
const BASE = location.pathname.replace(/\\/$/, '');
const hechos = new Set();

/* Un móvil hace fotos de 5-8 MB. Reescalar a 1600 px y JPEG 0.8 las deja en
   torno a 300 KB: sube en segundos con datos móviles y el DNI se sigue leyendo
   perfectamente. Los PDF se envían tal cual. */
async function comprimir(file) {
  if (file.type === 'application/pdf') return { blob: file, tipo: 'application/pdf' };
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return { blob: file, tipo: file.type || 'image/jpeg' };
  const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
  return blob ? { blob, tipo: 'image/jpeg' } : { blob: file, tipo: file.type || 'image/jpeg' };
}

function marcar(slot, estado, url) {
  const card = document.getElementById('doc-' + slot);
  if (!card) return;
  card.classList.remove('ok', 'error');
  const icono = card.querySelector('.estado');
  const mini = card.querySelector('.mini');
  if (estado === 'subiendo') { icono.textContent = '…'; return; }
  if (estado === 'error')    { card.classList.add('error'); icono.textContent = '!'; return; }
  card.classList.add('ok');
  if (url) { mini.src = url; mini.style.display = 'block'; icono.style.display = 'none'; }
  else { icono.textContent = '✓'; }
  hechos.add(slot);
}

const completo = () => SLOTS.length > 0 && hechos.size === SLOTS.length;

async function enviar(slot, file) {
  marcar(slot, 'subiendo');
  try {
    const { blob, tipo } = await comprimir(file);
    const res = await fetch(BASE + '/subir/' + slot, {
      method: 'PUT', headers: { 'Content-Type': tipo }, body: blob,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error');
    marcar(slot, 'ok', tipo === 'application/pdf' ? null : URL.createObjectURL(blob));
    if (completo()) { fetch(BASE + '/finalizar', { method: 'POST' }).catch(() => {}); pantallaFinal(); }
  } catch (e) {
    marcar(slot, 'error');
    alert('No se ha podido enviar: ' + e.message);
  }
}

function pantallaFinal() {
  document.querySelector('.env').innerHTML =
    '<div class="fin"><div class="tick">✅</div>' +
    '<h2>Recibido</h2>' +
    '<p>Ya lo tenemos todo. Te decimos algo en breve.</p></div>';
}

function pintarDescargas(lista) {
  const zona = document.getElementById('zona-descargas');
  if (!zona || !lista.length) return;
  const filas = lista.map(a => {
    const kb = Math.max(1, Math.round(a.bytes / 1024));
    const nombre = document.createElement('div');
    nombre.textContent = a.nombre;
    return '<a class="doc" href="' + BASE + '/bajar/' + encodeURIComponent(a.id) + '">'
      + '<div class="estado">↓</div><div class="txt"><h2>' + nombre.innerHTML + '</h2>'
      + '<p>' + kb + ' KB</p></div></a>';
  }).join('');
  zona.innerHTML = '<h3>Documentos para ti</h3>' + filas;
}

for (const slot of SLOTS) {
  const input = document.getElementById('in-' + slot);
  document.getElementById('doc-' + slot).onclick = () => input.click();
  input.onchange = () => { if (input.files[0]) enviar(slot, input.files[0]); input.value = ''; };
}

/* Al recargar se restaura lo ya subido, pero NO se vuelve a avisar al negocio:
   si no, cada refresco del navegador dispararía otra notificación. */
fetch(BASE + '/estado').then(r => r.json())
  .then(d => {
    (d.subidos || []).forEach(s => marcar(s, 'ok'));
    if (PUEDE_BAJAR) pintarDescargas(d.descargas || []);
    if (completo()) pantallaFinal();
  })
  .catch(() => {});
</script>`);
}

export default router;
