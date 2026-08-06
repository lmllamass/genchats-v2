/**
 * documentos.js — recogida de documentación del cliente final.
 *
 * Sustituye a los "file request" de Dropbox: n8n no puede crearlos (su credencial
 * no incluye el scope file_requests.write) y además daban un enlace anónimo de
 * dropbox.com, igual para todos y sin acuse de recibo. Aquí cada alumno recibe
 * un enlace personal y caducado, sube desde el móvil, y al terminar se avisa a
 * n8n para que marque su fila en el Excel.
 *
 * Es genérico a propósito: la carpeta destino y los documentos que se piden
 * salen de project_tools (tool_name = 'documentos'), así que sirve para
 * cualquier proyecto que necesite papeles del cliente, no solo para FADECOM.
 *
 * Rutas:
 *   POST /api/documentos/enlace        (n8n → genera el enlace firmado)
 *   GET  /d/:token                     (alumno → página de subida)
 *   GET  /d/:token/estado              (qué lleva subido ya)
 *   PUT  /d/:token/:slot               (sube un fichero, binario crudo)
 *   POST /d/:token/finalizar           (avisa a n8n)
 */
import express from 'express';
import { supabase } from '../server.js';
import { firmarToken, verificarToken } from '../lib/docsToken.js';
import { subirFichero, listarCarpeta } from '../lib/dropbox.js';

const router = express.Router();

const SLOTS_POR_DEFECTO = [
  { id: 'dni_anverso', titulo: 'DNI o NIE — parte delantera', ayuda: 'Que se vean las cuatro esquinas, sin reflejos.' },
  { id: 'dni_reverso', titulo: 'DNI o NIE — parte trasera',   ayuda: 'La cara de atrás del documento.' },
  { id: 'foto_carnet', titulo: 'Fotografía tipo carnet',      ayuda: 'De frente y sobre fondo claro. Vale un selfie bien iluminado.' },
];

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const TAM_MAXIMO = 15 * 1024 * 1024;

/** Nunca se usa texto del alumno para construir rutas: solo letras y dígitos. */
function idSeguro(valor) {
  return String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function cargarConfig(proyectoId) {
  const [{ data: proyecto }, { data: fila }] = await Promise.all([
    supabase.from('proyectos').select('id, nombre, chatbot_config').eq('id', proyectoId).single(),
    supabase.from('project_tools').select('config').eq('project_id', proyectoId).eq('tool_name', 'documentos').maybeSingle(),
  ]);
  if (!proyecto) return null;

  const chat = proyecto.chatbot_config || {};
  const cfg = fila?.config || {};
  return {
    proyecto,
    marca: {
      nombre: chat.nombre_negocio || proyecto.nombre,
      logo: chat.logo_url || '',
      color: chat.color_primario || '#6366f1',
    },
    carpetaBase: cfg.carpeta_base || '/Documentacion',
    slots: Array.isArray(cfg.slots) && cfg.slots.length ? cfg.slots : SLOTS_POR_DEFECTO,
    webhookConfirmacion: cfg.webhook_confirmacion || '',
    diasValidez: cfg.dias_validez || 7,
    avisoPrivacidad: cfg.aviso_privacidad
      || 'Las imágenes se usan únicamente para tramitar tu inscripción y se conservan '
       + 'el tiempo exigido por la normativa de formación. Puedes ejercer tus derechos '
       + 'de acceso y supresión escribiendo al centro.',
  };
}

/** Middleware: valida el token y deja el contexto listo en req.doc. */
async function conToken(req, res, next) {
  const payload = verificarToken(req.params.token);
  if (!payload) {
    // La página la abre una persona y espera HTML; el resto de rutas las llama
    // el JavaScript de esa página y espera JSON.
    if (req.method !== 'GET') return res.status(410).json({ error: 'Enlace caducado' });
    return res.status(410).type('html').send(paginaError(
      'Enlace no válido o caducado',
      'Por seguridad los enlaces caducan. Escribe al centro por el chat y te enviamos uno nuevo.'));
  }
  const config = await cargarConfig(payload.proyecto_id);
  if (!config) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const carpeta = `${config.carpetaBase}/${idSeguro(payload.dni)}`;
  req.doc = { payload, config, carpeta };
  next();
}

// ── n8n pide un enlace ──────────────────────────────────────────────────────
router.post('/api/documentos/enlace', async (req, res) => {
  try {
    if (!process.env.DOCS_WEBHOOK_SECRET
      || req.headers['x-docs-secret'] !== process.env.DOCS_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const { proyecto_id, dni, nombre, curso, sede, fecha } = req.body || {};
    if (!proyecto_id || !dni) return res.status(400).json({ error: 'proyecto_id y dni son obligatorios' });

    const config = await cargarConfig(proyecto_id);
    if (!config) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const token = firmarToken({ proyecto_id, dni: idSeguro(dni), nombre, curso, sede, fecha }, config.diasValidez);
    const base = process.env.DOCS_PUBLIC_URL || `https://${req.get('host')}`;

    res.json({
      ok: true,
      url: `${base}/d/${token}`,
      expira_en_dias: config.diasValidez,
      documentos: config.slots.map(s => s.titulo),
    });
  } catch (err) {
    console.error('[documentos] enlace:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── El alumno abre el enlace ────────────────────────────────────────────────
router.get('/d/:token', conToken, (req, res) => {
  res.type('html').send(paginaSubida(req.doc));
});

router.get('/d/:token/estado', conToken, async (req, res) => {
  try {
    const entradas = await listarCarpeta(req.doc.carpeta);
    const subidos = req.doc.config.slots
      .filter(s => entradas.some(e => e.name?.startsWith(`${s.id}.`)))
      .map(s => s.id);
    res.json({ subidos });
  } catch (err) {
    // Que no se pueda listar no debe impedir subir: la página sigue funcionando.
    console.error('[documentos] estado:', err.message);
    res.json({ subidos: [] });
  }
});

// conToken va ANTES del parser: si el enlace no vale, no tiene sentido leerse
// 15 MB de cuerpo antes de rechazarlo.
router.put('/d/:token/:slot',
  conToken,
  express.raw({ type: () => true, limit: TAM_MAXIMO }),
  async (req, res) => {
    try {
      const { payload, config, carpeta } = req.doc;
      const slot = config.slots.find(s => s.id === req.params.slot);
      if (!slot) return res.status(400).json({ error: 'Documento no reconocido' });

      const tipo = (req.get('content-type') || '').split(';')[0].toLowerCase();
      if (!TIPOS_PERMITIDOS.includes(tipo)) {
        return res.status(415).json({ error: 'Formato no admitido. Envía una foto o un PDF.' });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'Fichero vacío' });
      }

      const ext = tipo === 'application/pdf' ? 'pdf' : tipo.split('/')[1].replace('jpeg', 'jpg');
      await subirFichero(`${carpeta}/${slot.id}.${ext}`, req.body);

      console.log(`[documentos] ${payload.dni} · ${slot.id} · ${(req.body.length / 1024).toFixed(0)} KB`);
      res.json({ ok: true, slot: slot.id });
    } catch (err) {
      console.error('[documentos] subida:', err.message);
      res.status(500).json({ error: 'No se ha podido guardar. Inténtalo otra vez.' });
    }
  });

router.post('/d/:token/finalizar', express.json(), conToken, async (req, res) => {
  const { payload, config, carpeta } = req.doc;
  try {
    if (config.webhookConfirmacion) {
      // Si n8n falla, el alumno no tiene la culpa: los ficheros ya están en
      // Dropbox, así que se le confirma igual y el fallo queda en el log.
      await fetch(config.webhookConfirmacion, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento: 'documentacion_recibida',
          proyecto_id: payload.proyecto_id,
          dni: payload.dni,
          nombre: payload.nombre || null,
          carpeta,
          recibido_en: new Date().toISOString(),
        }),
      }).catch(err => console.error('[documentos] webhook n8n:', err.message));
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[documentos] finalizar:', err.message);
    res.json({ ok: true });
  }
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
  .ficha{background:#fff;border-radius:12px;padding:14px 16px;margin:16px 0;
         box-shadow:0 1px 3px rgba(0,0,0,.08);font-size:14px}
  .ficha b{display:block;font-size:16px;margin-bottom:2px}
  .ficha span{color:#5b6472}
  .doc{background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;
       box-shadow:0 1px 3px rgba(0,0,0,.08);display:flex;gap:14px;align-items:center}
  .doc h2{margin:0 0 2px;font-size:15px;font-weight:600}
  .doc p{margin:0;font-size:13px;color:#5b6472}
  .doc .txt{flex:1;min-width:0}
  .mini{width:56px;height:56px;border-radius:9px;object-fit:cover;flex-shrink:0;display:none}
  .estado{width:56px;height:56px;border-radius:9px;flex-shrink:0;display:flex;
          align-items:center;justify-content:center;font-size:24px;background:#eef0f4;color:#96a0ae}
  .doc.ok .estado{background:#e7f7ed;color:#1a9c4b}
  .doc.ok{border:1px solid #bfe8cd}
  .doc.error .estado{background:#fdecec;color:#d33}
  button.sel{width:100%;border:0;border-radius:10px;background:${color};color:#fff;
             font-size:16px;font-weight:600;padding:14px;margin-top:6px}
  button.sel:disabled{opacity:.5}
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

function paginaSubida({ payload, config }) {
  const { marca, slots, avisoPrivacidad } = config;
  const datos = [payload.curso, payload.sede, payload.fecha].filter(Boolean).join(' · ');

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

  return envoltorio(`Documentación · ${marca.nombre}`, marca.color, `
<div class="cab">
  ${marca.logo ? `<img src="${esc(marca.logo)}" alt="${esc(marca.nombre)}">` : ''}
  <h1>${esc(marca.nombre)}</h1>
  <p>Documentación para tu inscripción</p>
</div>
<div class="env">
  <div class="ficha">
    <b>${esc(payload.nombre || 'Alumno/a')}</b>
    <span>DNI ${esc(payload.dni)}${datos ? ` · ${esc(datos)}` : ''}</span>
  </div>
  <div id="lista">${tarjetas}</div>
  <p class="aviso">${esc(avisoPrivacidad)}</p>
</div>
<script>
const SLOTS = ${JSON.stringify(slots.map(s => s.id))};
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

function completo() { return hechos.size === SLOTS.length; }

async function enviar(slot, file) {
  marcar(slot, 'subiendo');
  try {
    const { blob, tipo } = await comprimir(file);
    const res = await fetch(BASE + '/' + slot, {
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
    '<h2>Documentación recibida</h2>' +
    '<p>Ya la tenemos. Te confirmamos la plaza en breve por el chat.</p></div>';
}

for (const slot of SLOTS) {
  const input = document.getElementById('in-' + slot);
  document.getElementById('doc-' + slot).onclick = () => input.click();
  input.onchange = () => { if (input.files[0]) enviar(slot, input.files[0]); input.value = ''; };
}

/* Al recargar se restaura lo ya subido, pero NO se vuelve a avisar a n8n: si no,
   cada refresco del navegador dispararía otra notificación al centro. */
fetch(BASE + '/estado').then(r => r.json())
  .then(d => {
    (d.subidos || []).forEach(s => marcar(s, 'ok'));
    if (completo()) pantallaFinal();
  })
  .catch(() => {});
</script>`);
}

export default router;
