import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// MEJORA 5 — Markdown to HTML
function mdToHtml(text) {
  if (!text) return "";
  let t = String(text);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  t = t.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  t = t.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  return t;
}

function cleanScrapedContent(markdown, mainUrl) {
  if (!markdown) return "";
  let mainDomain = "";
  try { mainDomain = new URL(mainUrl).hostname.replace(/^www\./, ''); } catch {}
  let lines = markdown.split('\n');
  lines = lines.filter(line => {
    if (/https?:\/\//.test(line)) {
      if (mainDomain && line.includes(mainDomain)) return true;
      return false;
    }
    return true;
  });
  lines = lines.filter(line => !(line.trim().startsWith('[') && /\]\(https?:\/\//.test(line)));
  let text = lines.join('\n');
  text = text.replace(/\\{2,}/g, '');
  text = text.replace(/\\n/g, '\n');
  text = text.replace(/\\t/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim().slice(0, 2000);
  return text;
}

// MEJORA 3 — Call OpenAI for better copy
async function getAICopy(cleanedMarkdown, metadata) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return null;

  const contenidoLimpio = (cleanedMarkdown || '').slice(0, 1500);
  const titulo = metadata?.title || '';
  const desc = metadata?.description || '';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Eres un copywriter experto en webs para pymes españolas.

Con este contenido scrapeado de un negocio:
Título: ${titulo}
Descripción: ${desc}
Contenido: ${contenidoLimpio}

Genera en JSON con esta estructura exacta:
{
  "sector": "una palabra del sector en inglés (storage, hardware, restaurant, clinic, bakery, gym...)",
  "keywords_ingles": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "titulo_hero": "Título impactante máximo 6 palabras",
  "subtitulo_hero": "Subtítulo claro máximo 15 palabras",
  "seccion1": { "titulo": "máx 5 palabras", "texto": "máx 40 palabras" },
  "seccion2": { "titulo": "máx 5 palabras", "texto": "máx 40 palabras" },
  "seccion3": { "titulo": "máx 5 palabras", "texto": "máx 40 palabras" },
  "cta": "Texto del botón máx 4 palabras",
  "metricas": [
    {"numero": "500+", "label": "Clientes"},
    {"numero": "98%", "label": "Satisfacción"},
    {"numero": "10+", "label": "Años"}
  ]
}

Solo devuelve el JSON, sin explicaciones ni bloques de código.`
      }],
      max_tokens: 800,
      temperature: 0.7
    })
  });

  const aiData = await response.json();
  const raw = (aiData.choices?.[0]?.message?.content || '').trim();
  // Strip markdown code fences if present
  const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(jsonStr);
}

function buildHtmlV2({ template, scheme, content, aiCopy }) {
  const ai = aiCopy || {};
  const kw = ai.keywords_ingles || ['business', 'professional', 'office', 'team'];
  const sector = ai.sector || 'business';

  const brandFonts = content.brand_fonts || [];
  const primaryFont = brandFonts[0] || 'Inter';
  const fontImport = brandFonts.length > 0
    ? brandFonts.map(f => f.replace(/ /g, '+')).map(f => `family=${f}:wght@300;400;500;600;700;800;900`).join('&')
    : 'family=Inter:wght@300;400;500;600;700;800;900';

  const titulo = ai.titulo_hero || content.titulo || "Tu negocio, en lo más alto";
  const subtitulo = ai.subtitulo_hero || content.subtitulo || "Soluciones profesionales para tu empresa";
  const ctaTexto = ai.cta || content.cta_texto || "Contactar ahora";
  const telefono = content.telefono || "+34 600 000 000";
  const email = content.email || "hola@tuempresa.com";
  const direccion = content.direccion || "Madrid, España";
  const logoUrl = content.logo_url || "";
  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="logo" style="height:32px;border-radius:6px" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">`
      + `<span style="display:none;font-weight:800;font-size:20px;color:#fff">${esc(titulo)}</span>`
    : `<span style="font-weight:800;font-size:20px;color:#fff;letter-spacing:-0.02em">${esc(content.titulo || titulo)}</span>`;

  const sec1 = ai.seccion1 || { titulo: "Nuestros Servicios", texto: "Ofrecemos soluciones profesionales adaptadas a tus necesidades." };
  const sec2 = ai.seccion2 || { titulo: "Por Qué Elegirnos", texto: "Experiencia, calidad y compromiso con cada proyecto." };
  const sec3 = ai.seccion3 || { titulo: "Nuestro Compromiso", texto: "Trabajamos para superar tus expectativas día a día." };

  const metrics = ai.metricas || [
    { numero: "500+", label: "Clientes" },
    { numero: "98%", label: "Satisfacción" },
    { numero: "10+", label: "Años" }
  ];

  // MEJORA 2 — Unsplash images
  const heroImg = `https://source.unsplash.com/1600x900/?${encodeURIComponent(kw[0] + ',' + sector)}`;
  const aboutImg = `https://source.unsplash.com/600x400/?${encodeURIComponent(kw[1] + ',' + sector)}`;
  const svcImgs = kw.map((k, i) => `https://source.unsplash.com/400x200/?${encodeURIComponent(k + ',' + kw[(i+1) % kw.length])}`);
  const galleryImgs = [
    `https://source.unsplash.com/500x400/?${encodeURIComponent(sector + ',' + kw[0])}`,
    `https://source.unsplash.com/500x400/?${encodeURIComponent(sector + ',' + kw[1])}`,
    `https://source.unsplash.com/500x400/?${encodeURIComponent(sector + ',' + kw[2])}`
  ];

  // MEJORA 1 — Nav labels (max 2 words, fixed)
  const navLinks = [
    { label: "Nosotros", href: "#nosotros" },
    { label: "Servicios", href: "#servicios" },
    { label: "Galería", href: "#galeria" },
  ];
  const navHtml = navLinks.map(l =>
    `<a href="${l.href}" style="color:#a5b4fc;text-decoration:none;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;transition:color 0.2s" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#a5b4fc'">${l.label}</a>`
  ).join('');

  // MEJORA 4 — Metrics HTML with fixed indigo bg
  const metricsHtml = metrics.map(m =>
    `<div style="text-align:center"><div style="font-size:48px;font-weight:900;letter-spacing:-2px;line-height:1">${esc(m.numero)}</div><div style="font-size:13px;text-transform:uppercase;letter-spacing:2px;opacity:0.85;margin-top:8px">${esc(m.label)}</div></div>`
  ).join('');

  // Services cards with Unsplash images
  const servicesArr = content.sections || [sec1, sec2, sec3].map(s => ({ title: s.titulo, body: s.texto }));
  const servicesHtml = servicesArr.slice(0, 6).map((s, i) => {
    const t = mdToHtml(s.title || s.titulo || `Servicio ${i+1}`);
    const b = mdToHtml(s.body || s.texto || '');
    const img = svcImgs[i % svcImgs.length];
    return `<div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
<img src="${img}" alt="${esc(s.title || s.titulo || '')}" style="width:100%;height:160px;object-fit:cover" loading="lazy" onerror="this.style.display='none'" />
<div style="padding:24px">
<h3 style="font-size:18px;font-weight:700;color:#1a1a2e;margin-bottom:8px;letter-spacing:-0.02em">${t}</h3>
<p style="font-size:15px;color:#475569;line-height:1.7">${b}</p>
</div></div>`;
  }).join('');

  // Gallery section
  const galleryHtml = galleryImgs.map((g, i) =>
    `<img src="${g}" alt="gallery-${i}" style="width:100%;height:250px;object-fit:cover;border-radius:12px" loading="lazy" onerror="this.style.display='none'" />`
  ).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(content.titulo || titulo)}</title>
<meta name="description" content="${esc(subtitulo)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?${fontImport}&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:'${primaryFont}',-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%}
.container{max-width:1200px;margin:0 auto;padding:0 32px}
@media(max-width:768px){
  .nav-links-inner{display:none!important}
  .hero-inner{padding:0 16px}
  .hero-inner h1{font-size:36px!important}
  .stats-grid{grid-template-columns:repeat(2,1fr)!important}
  .services-grid{grid-template-columns:1fr!important}
  .about-grid{grid-template-columns:1fr!important}
  .gallery-grid{grid-template-columns:1fr!important}
  .footer-grid{grid-template-columns:1fr!important}
}
@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
</style>
</head>
<body>

<!-- NAVBAR — #1a1a2e -->
<nav style="position:fixed;top:0;left:0;right:0;z-index:100;background:#1a1a2e;border-bottom:1px solid rgba(255,255,255,0.06);overflow:hidden">
<div class="container" style="display:flex;align-items:center;justify-content:space-between;padding-top:14px;padding-bottom:14px">
<a href="#" style="text-decoration:none;display:flex;align-items:center;gap:8px">${logoHtml}</a>
<div class="nav-links-inner" style="display:flex;align-items:center;gap:28px">
${navHtml}
</div>
<a href="#contacto" onclick="event.preventDefault();document.getElementById('contacto').scrollIntoView({behavior:'smooth'})" style="background:#6366f1;color:#fff;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;transition:opacity 0.2s" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">Contacto</a>
</div>
</nav>

<!-- HERO — Unsplash bg + overlay -->
<section style="position:relative;min-height:100vh;display:flex;align-items:center;overflow:hidden;background:url('${heroImg}') center/cover no-repeat;padding-top:70px">
<div style="position:absolute;inset:0;background:rgba(0,0,0,0.65)"></div>
<div class="container">
<div class="hero-inner" style="position:relative;z-index:2;max-width:750px;animation:fadeUp 0.8s ease-out">
<h1 style="font-size:clamp(40px,6vw,72px);font-weight:900;color:#ffffff;letter-spacing:-3px;line-height:1.05;margin-bottom:24px">${mdToHtml(esc(titulo))}</h1>
<p style="font-size:20px;color:rgba(255,255,255,0.9);margin-bottom:40px;line-height:1.7;max-width:600px">${mdToHtml(esc(subtitulo))}</p>
<div style="display:flex;flex-wrap:wrap;gap:16px">
<a href="#contacto" onclick="event.preventDefault();document.getElementById('contacto').scrollIntoView({behavior:'smooth'})" style="display:inline-block;padding:16px 36px;background:#6366f1;color:#fff;border-radius:10px;font-weight:700;font-size:16px;text-decoration:none;transition:all 0.3s;box-shadow:0 0 30px rgba(99,102,241,0.4)" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 12px 35px rgba(99,102,241,0.5)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 0 30px rgba(99,102,241,0.4)'">${esc(ctaTexto)}</a>
<a href="#servicios" onclick="event.preventDefault();document.getElementById('servicios').scrollIntoView({behavior:'smooth'})" style="display:inline-block;padding:16px 36px;background:transparent;border:2px solid rgba(255,255,255,0.4);color:#fff;border-radius:10px;font-weight:700;font-size:16px;text-decoration:none;transition:all 0.3s" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.borderColor='#fff'" onmouseout="this.style.background='transparent';this.style.borderColor='rgba(255,255,255,0.4)'">Descubre más</a>
</div>
</div>
</div>
</section>

<!-- METRICS — #6366f1 indigo -->
<section style="padding:80px 0;background:#6366f1;color:#ffffff">
<div class="container">
<div class="stats-grid" style="display:grid;grid-template-columns:repeat(${metrics.length},1fr);gap:32px">${metricsHtml}</div>
</div>
</section>

<!-- ABOUT — #f8fafc light -->
<section id="nosotros" style="padding:100px 0;background:#f8fafc;color:#1a1a2e">
<div class="container">
<div class="about-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center">
<div>
<h2 style="font-size:36px;font-weight:800;letter-spacing:-1px;line-height:1.2;margin-bottom:20px;color:#1a1a2e">${mdToHtml(esc(sec2.titulo))}</h2>
<p style="font-size:17px;line-height:1.8;color:#475569">${mdToHtml(esc(sec2.texto))}</p>
</div>
<div>
<img src="${aboutImg}" alt="about" style="width:100%;height:350px;object-fit:cover;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.12)" loading="lazy" onerror="this.style.display='none'" />
</div>
</div>
</div>
</section>

<!-- SERVICES — #ffffff white -->
<section id="servicios" style="padding:100px 0;background:#ffffff;color:#1a1a2e">
<div class="container">
<div style="text-align:center;margin-bottom:48px">
<h2 style="font-size:36px;font-weight:800;letter-spacing:-1px;color:#1a1a2e;margin-bottom:12px">${mdToHtml(esc(sec1.titulo))}</h2>
<p style="font-size:17px;color:#64748b;max-width:550px;margin:0 auto">${mdToHtml(esc(sec1.texto))}</p>
</div>
<div class="services-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px">
${servicesHtml}
</div>
</div>
</section>

<!-- GALLERY — #f8fafc -->
<section id="galeria" style="padding:80px 0;background:#f8fafc;color:#1a1a2e">
<div class="container">
<h2 style="font-size:32px;font-weight:800;letter-spacing:-1px;text-align:center;margin-bottom:40px;color:#1a1a2e">Galería</h2>
<div class="gallery-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">${galleryHtml}</div>
</div>
</section>

<!-- CONTACT FORM — #111827 -->
<section id="contacto" style="padding:80px 40px;background:#111827;text-align:center">
<h2 style="font-size:32px;color:#ffffff;margin-bottom:8px;font-weight:800;letter-spacing:-1px">¿Hablamos?</h2>
<p style="color:#94a3b8;margin-bottom:40px;max-width:480px;margin-left:auto;margin-right:auto;font-size:16px;line-height:1.7">Cuéntanos qué necesitas y te respondemos en menos de 24 horas.</p>
<form style="max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:16px" onsubmit="event.preventDefault();this.querySelector('button').textContent='✓ Enviado';this.querySelector('button').style.background='#10b981'">
<input type="text" placeholder="Tu nombre" required style="padding:14px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#f8fafc;font-size:15px;font-family:inherit" />
<input type="email" placeholder="Tu email" required style="padding:14px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#f8fafc;font-size:15px;font-family:inherit" />
<input type="tel" placeholder="Teléfono (opcional)" style="padding:14px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#f8fafc;font-size:15px;font-family:inherit" />
<textarea placeholder="¿En qué podemos ayudarte?" rows="4" style="padding:14px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#f8fafc;font-size:15px;resize:vertical;font-family:inherit"></textarea>
<button type="submit" style="padding:16px 32px;border-radius:12px;border:none;cursor:pointer;background:#6366f1;color:#fff;font-size:16px;font-weight:600;box-shadow:0 0 30px rgba(99,102,241,0.4);transition:all 0.3s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">Enviar mensaje →</button>
</form>
<p style="margin-top:24px;color:#64748b;font-size:13px">🔒 Tus datos están seguros. No hacemos spam.</p>
</section>

<!-- FOOTER — #0a0a0f -->
<footer style="background:#0a0a0f;color:#94a3b8;padding:60px 0 30px">
<div class="container">
<div class="footer-grid" style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px;margin-bottom:40px">
<div>
<div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:12px;letter-spacing:-0.5px">${esc(content.titulo || titulo)}</div>
<p style="font-size:14px;color:#64748b;line-height:1.7;max-width:300px">${esc(subtitulo)}</p>
</div>
<div>
<h4 style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#475569;margin-bottom:14px">Contacto</h4>
<p style="font-size:14px;color:#94a3b8;margin-bottom:6px">${esc(email)}</p>
<p style="font-size:14px;color:#94a3b8">${esc(telefono)}</p>
</div>
<div>
<h4 style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#475569;margin-bottom:14px">Dirección</h4>
<p style="font-size:14px;color:#94a3b8">${esc(direccion)}</p>
</div>
</div>
<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;text-align:center;font-size:13px;color:#334155">© ${new Date().getFullYear()} ${esc(content.titulo || titulo)}. Todos los derechos reservados.</div>
</div>
</footer>

</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { proyecto_id, template, scheme, content } = await req.json();
    if (!proyecto_id) return Response.json({ error: 'proyecto_id is required' }, { status: 400 });

    const proyecto = await base44.entities.Proyecto.get(proyecto_id);
    let cleanedContent = content || {};

    // Clean scraped markdown
    const rawMd = cleanedContent.raw_markdown || proyecto?.contenido_scrapeado || "";
    const mainUrl = proyecto?.url_origen || "";
    const cleanedMarkdown = cleanScrapedContent(rawMd, mainUrl);

    // Extract phone/email from scraped content
    const lines = cleanedMarkdown.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if ((!cleanedContent.telefono || cleanedContent.telefono === "+34 600 000 000") && /(\+?\d[\d\s\-]{7,})/.test(line)) {
        cleanedContent.telefono = line.match(/(\+?\d[\d\s\-]{7,})/)[1].trim();
      }
      if ((!cleanedContent.email || cleanedContent.email === "hola@tuempresa.com") && /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/.test(line)) {
        cleanedContent.email = line.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/)[1];
      }
    }

    // Clean section bodies
    if (cleanedContent.sections) {
      cleanedContent.sections = cleanedContent.sections.map(s => ({
        ...s,
        body: cleanScrapedContent(s.body || '', mainUrl),
      }));
    }

    // MEJORA 3 — AI-enhanced copy
    let aiCopy = null;
    try {
      aiCopy = await getAICopy(cleanedMarkdown, proyecto?.metadata_scrapeado);
    } catch (e) {
      console.log('AI copy generation failed, using defaults:', e.message);
    }

    const html = buildHtmlV2({
      template: template || 'moderna',
      scheme: scheme || 'azul_profesional',
      content: cleanedContent,
      aiCopy,
    });

    await base44.entities.Proyecto.update(proyecto_id, {
      html_generado: html,
      plantilla_elegida: template,
      esquema_color: scheme,
      contenido_editable: content,
      estado: 'revision',
    });

    return Response.json({ html });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});