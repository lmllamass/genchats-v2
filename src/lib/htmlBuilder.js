import { COLOR_SCHEMES } from "./templates";

const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function getTemplateStyles(template) {
  const shared = `
    .hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .hero-overlay{position:absolute;inset:0}
    .section-img{width:100%;height:320px;object-fit:cover;border-radius:16px}
  `;
  const map = {
    moderna: shared + `
      .hero-overlay{background:linear-gradient(135deg,rgba(0,0,0,.7),rgba(0,0,0,.4))}
      .hero h1{font-size:clamp(40px,6vw,80px);font-weight:900;letter-spacing:-3px;line-height:1.02}
      .section-title::after{content:'';display:block;width:60px;height:4px;background:var(--primary);margin-top:12px;border-radius:2px}
    `,
    clasica: shared + `
      .hero-overlay{background:linear-gradient(180deg,rgba(0,0,0,.6),rgba(0,0,0,.3))}
      .hero h1{font-size:clamp(36px,5vw,68px);font-weight:700;font-style:italic}
      .section-title{font-style:italic}
    `,
    minimalista: shared + `
      .hero-overlay{background:rgba(255,255,255,.85)}
      .hero{color:var(--text)!important}
      .hero h1{font-size:clamp(36px,5vw,72px);font-weight:200;letter-spacing:-2px}
      .hero .hero-sub{opacity:.6}
      .hero .btn{background:var(--text);color:var(--bg)}
    `,
    corporativa: shared + `
      .hero-overlay{background:linear-gradient(180deg,rgba(0,0,0,.75),rgba(0,0,0,.5))}
      .hero h1{font-size:clamp(36px,5vw,60px);font-weight:700;text-transform:uppercase;letter-spacing:2px}
      .section-title{text-transform:uppercase;letter-spacing:3px;font-size:14px;font-weight:700}
    `,
    ecommerce: shared + `
      .hero-overlay{background:linear-gradient(135deg,var(--primary-alpha),var(--secondary-alpha))}
      .hero h1{font-size:clamp(40px,6vw,76px);font-weight:800}
      .btn{border-radius:50px;padding:16px 40px}
    `,
  };
  return map[template] || map.moderna;
}

export function buildHtml({ template = "moderna", scheme = "azul_profesional", content = {} }) {
  const colors = COLOR_SCHEMES[scheme] || COLOR_SCHEMES.azul_profesional;
  
  // Use brand colors if available, then user overrides, then scheme defaults
  const brandColors = content.brand_colors || {};
  const primary = content.color_primario || brandColors.primary || colors.primary;
  const secondary = content.color_secundario || brandColors.secondary || colors.secondary;
  const isDark = scheme === 'oscuro_premium';

  // Brand fonts — use original page fonts if extracted
  const brandFonts = content.brand_fonts || [];
  const primaryFont = brandFonts[0] || 'Inter';
  const fontImport = brandFonts.length > 0
    ? brandFonts.map(f => f.replace(/ /g, '+')).map(f => `family=${f}:wght@300;400;500;600;700;800;900`).join('&')
    : 'family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,400;0,700;1,400';

  const c = {
    titulo: content.titulo || "Tu título aquí",
    subtitulo: content.subtitulo || "Subtítulo descriptivo de la página",
    logo_url: content.logo_url || "",
    hero_image: content.hero_image || "",
    cta_texto: content.cta_texto || "Empezar ahora",
    cta_url: content.cta_url || "#contacto",
    telefono: content.telefono || "+34 600 000 000",
    email: content.email || "hola@tuempresa.com",
    direccion: content.direccion || "Madrid, España",
  };

  const sections = content.sections || [
    { title: "Nuestros Servicios", body: "Ofrecemos soluciones profesionales adaptadas a tus necesidades." },
    { title: "Por Qué Elegirnos", body: "Experiencia, calidad y compromiso con la excelencia." },
    { title: "Resultados", body: "Miles de clientes satisfechos confían en nuestro trabajo." },
  ];

  const images = content.original_images || [];

  // Only anchor links to own sections — never external URLs
  const navHtml = sections.slice(0, 5).map((s, i) =>
    `<a href="#${i === 0 ? 'servicios' : `seccion-${i}`}" class="nav-link">${esc(s.title)}</a>`
  ).join('') + `<a href="#contacto" class="nav-link">Contacto</a>`;

  // Sections with original images or elegant fallback
  const sectionsHtml = sections.map((s, i) => {
    const isReversed = i % 2 === 1;
    const sectionImage = images[i] || '';
    
    const mediaHtml = sectionImage
      ? `<img src="${esc(sectionImage)}" alt="${esc(s.title)}" class="section-img" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        + `<div class="section-img-fallback" style="display:none"><span>${esc(s.title.charAt(0))}</span></div>`
      : `<div class="section-img-fallback"><span>${esc(s.title.charAt(0))}</span></div>`;

    const sectionId = i === 0 ? 'servicios' : `seccion-${i}`;
    return `
    <section class="content-section" id="${sectionId}">
      <div class="container">
        <div class="section-grid ${isReversed ? 'reversed' : ''}">
          <div class="section-text">
            <h2 class="section-title">${esc(s.title)}</h2>
            <p class="section-body">${esc(s.body)}</p>
          </div>
          <div class="section-media">
            ${mediaHtml}
          </div>
        </div>
      </div>
    </section>`;
  }).join('');

  const stats = [
    { num: "500+", label: "Proyectos" },
    { num: "98%", label: "Satisfacción" },
    { num: "10+", label: "Años" },
    { num: "24/7", label: "Soporte" },
  ];
  const statsHtml = stats.map(s =>
    `<div class="stat"><div class="stat-num">${s.num}</div><div class="stat-label">${s.label}</div></div>`
  ).join('');

  const hasHeroImage = !!c.hero_image;
  const heroImgHtml = hasHeroImage
    ? `<img src="${esc(c.hero_image)}" alt="hero" class="hero-img" loading="eager" onerror="this.style.display='none'">`
    : '';

  const logoHtml = c.logo_url
    ? `<img src="${esc(c.logo_url)}" alt="logo" onerror="this.style.display='none';this.parentElement.textContent='${esc(c.titulo).replace(/'/g, "\\'")}'">`
    : esc(c.titulo);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(c.titulo)}</title>
<meta name="description" content="${esc(c.subtitulo)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?${fontImport}&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --primary:${primary};--secondary:${secondary};--bg:${colors.bg};--text:${colors.text};
  --primary-alpha:${primary}cc;--secondary-alpha:${secondary}cc;
  --card-bg:${isDark ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.9)'};
  --card-border:${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'};
  --glass:${isDark ? 'rgba(15,15,20,.8)' : 'rgba(255,255,255,.85)'};
}
html{scroll-behavior:smooth}
body{font-family:'${primaryFont}',-apple-system,BlinkMacSystemFont,sans-serif;color:var(--text);background:var(--bg);line-height:1.7;-webkit-font-smoothing:antialiased}
.container{max-width:1200px;margin:0 auto;padding:0 32px}
img{display:block;max-width:100%}

/* NAV */
.nav-wrap{position:fixed;top:0;left:0;right:0;z-index:100;transition:all .3s}
.nav-wrap.scrolled{background:var(--glass);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 1px 30px rgba(0,0,0,.1)}
.nav{display:flex;align-items:center;justify-content:space-between;padding:20px 0}
.nav-logo{font-weight:800;font-size:22px;color:#fff;text-decoration:none;letter-spacing:-.5px;display:flex;align-items:center;gap:10px}
.nav-wrap.scrolled .nav-logo{color:var(--primary)}
.nav-logo img{height:36px;border-radius:6px}
.nav-links{display:flex;gap:28px;align-items:center}
.nav-link{color:rgba(255,255,255,.85);text-decoration:none;font-size:14px;font-weight:500;transition:color .2s;letter-spacing:.3px}
.nav-wrap.scrolled .nav-link{color:var(--text)}
.nav-link:hover{color:var(--primary)}
.nav-cta{padding:10px 24px;background:var(--primary);color:#fff!important;border-radius:8px;font-weight:600;transition:all .3s}
.nav-cta:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,.2)}

/* HERO */
.hero{position:relative;min-height:100vh;display:flex;align-items:center;color:#fff;overflow:hidden;background:linear-gradient(135deg,var(--primary),var(--secondary))}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero-overlay{position:absolute;inset:0}
.hero-content{position:relative;z-index:2;max-width:800px}
.hero h1{margin-bottom:24px}
.hero-sub{font-size:20px;opacity:.9;margin-bottom:40px;line-height:1.7;max-width:600px}
.btn{display:inline-block;padding:16px 36px;background:var(--primary);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px;transition:all .3s;border:none;cursor:pointer;letter-spacing:.3px}
.btn:hover{transform:translateY(-3px);box-shadow:0 12px 35px rgba(0,0,0,.2)}
.btn-outline{background:transparent;border:2px solid rgba(255,255,255,.4);margin-left:16px}
.btn-outline:hover{background:rgba(255,255,255,.15);border-color:#fff}

/* SECTIONS */
.content-section{padding:100px 0}
.content-section:nth-child(even){background:${isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)'}}
.section-grid{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.section-grid.reversed{direction:rtl}
.section-grid.reversed>*{direction:ltr}
.section-title{font-size:36px;font-weight:800;margin-bottom:20px;letter-spacing:-1px;line-height:1.2}
.section-body{font-size:17px;line-height:1.8;opacity:.8}
.section-img{width:100%;height:320px;object-fit:cover;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.15);transition:transform .4s}
.section-img:hover{transform:scale(1.03)}
.section-img-fallback{width:100%;height:320px;border-radius:16px;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;opacity:.15}
.section-img-fallback span{font-size:80px;font-weight:900;color:#fff;opacity:.5}

/* STATS */
.stats-section{padding:80px 0;background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:32px;text-align:center}
.stat-num{font-size:48px;font-weight:900;letter-spacing:-2px;line-height:1}
.stat-label{font-size:14px;text-transform:uppercase;letter-spacing:2px;opacity:.8;margin-top:8px}

/* CTA BANNER */
.cta-banner{padding:100px 0;text-align:center;position:relative;overflow:hidden}
.cta-banner::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,var(--primary),var(--secondary));opacity:.08}
.cta-banner h2{font-size:42px;font-weight:800;margin-bottom:16px;letter-spacing:-1px}
.cta-banner p{font-size:18px;opacity:.7;margin-bottom:36px;max-width:550px;margin-left:auto;margin-right:auto}

/* FOOTER */
.footer{background:${isDark ? '#080810' : '#0f172a'};color:#fff;padding:80px 0 30px}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:48px}
.footer-brand{font-size:24px;font-weight:800;margin-bottom:16px;letter-spacing:-.5px}
.footer-desc{font-size:14px;opacity:.6;line-height:1.7;max-width:300px}
.footer h4{font-size:13px;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;opacity:.5}
.footer a{color:rgba(255,255,255,.75);text-decoration:none;font-size:14px;display:block;margin-bottom:10px;transition:color .2s}
.footer a:hover{color:var(--primary)}
.footer p{color:rgba(255,255,255,.6);font-size:14px;margin-bottom:8px}
.footer-bottom{border-top:1px solid rgba(255,255,255,.08);padding-top:24px;text-align:center;font-size:13px;opacity:.4}

/* RESPONSIVE */
@media(max-width:768px){
  .nav-links{display:none}
  .section-grid,.section-grid.reversed{grid-template-columns:1fr;gap:32px;direction:ltr}
  .stats-grid{grid-template-columns:repeat(2,1fr)}
  .footer-grid{grid-template-columns:1fr}
  .hero{min-height:80vh}
  .hero-content{padding:0 8px}
  .btn-outline{margin-left:0;margin-top:12px;display:inline-block}
}

/* TEMPLATE */
${getTemplateStyles(template)}

/* ANIMATIONS */
@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
.hero-content{animation:fadeUp .8s ease-out}
</style>
</head>
<body>

<div class="nav-wrap" id="navbar">
<div class="container">
<nav class="nav">
<a href="#" class="nav-logo">${logoHtml}</a>
<div class="nav-links">
${navHtml}
<a href="${esc(c.cta_url)}" class="nav-link nav-cta">${esc(c.cta_texto)}</a>
</div>
</nav>
</div>
</div>

<section class="hero">
${heroImgHtml}
<div class="hero-overlay"></div>
<div class="container">
<div class="hero-content">
<h1>${esc(c.titulo)}</h1>
<p class="hero-sub">${esc(c.subtitulo)}</p>
<div>
<a href="#contacto" class="btn" onclick="event.preventDefault();document.getElementById('contacto').scrollIntoView({behavior:'smooth'})">${esc(c.cta_texto)}</a>
<a href="#servicios" class="btn btn-outline" onclick="event.preventDefault();document.getElementById('servicios').scrollIntoView({behavior:'smooth'})">Descubre más</a>
</div>
</div>
</div>
</section>

<section class="stats-section">
<div class="container">
<div class="stats-grid">${statsHtml}</div>
</div>
</section>

${sectionsHtml}

<section id="contacto" style="padding:80px 40px;background:${isDark ? '#0a0a12' : '#111118'};text-align:center;">
<h2 style="font-size:32px;color:#f8fafc;margin-bottom:8px;font-weight:800;letter-spacing:-1px;">¿Hablamos?</h2>
<p style="color:#94a3b8;margin-bottom:40px;max-width:480px;margin-left:auto;margin-right:auto;font-size:16px;line-height:1.7;">
Cuéntanos qué necesitas y te respondemos en menos de 24 horas.
</p>
<form style="max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:16px;" onsubmit="event.preventDefault();alert('¡Mensaje enviado! Te contactaremos pronto.');">
<input type="text" placeholder="Tu nombre" required style="padding:14px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#f8fafc;font-size:15px;font-family:inherit;" />
<input type="email" placeholder="Tu email" required style="padding:14px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#f8fafc;font-size:15px;font-family:inherit;" />
<input type="tel" placeholder="Teléfono (opcional)" style="padding:14px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#f8fafc;font-size:15px;font-family:inherit;" />
<textarea placeholder="¿En qué podemos ayudarte?" rows="4" style="padding:14px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#f8fafc;font-size:15px;resize:vertical;font-family:inherit;"></textarea>
<button type="submit" style="padding:16px 32px;border-radius:12px;border:none;cursor:pointer;background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;font-size:16px;font-weight:600;box-shadow:0 0 30px rgba(99,102,241,0.4);transition:transform .2s,box-shadow .2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 30px rgba(99,102,241,0.5)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 0 30px rgba(99,102,241,0.4)'">
Enviar mensaje →
</button>
</form>
<p style="margin-top:24px;color:#64748b;font-size:13px;">🔒 Tus datos están seguros. No hacemos spam.</p>
</section>

<footer class="footer">
<div class="container">
<div class="footer-grid">
<div>
<div class="footer-brand">${esc(c.titulo)}</div>
<p class="footer-desc">${esc(c.subtitulo)}</p>
</div>
<div>
<h4>Contacto</h4>
<p>${esc(c.email)}</p>
<p>${esc(c.telefono)}</p>
</div>
<div>
<h4>Dirección</h4>
<p>${esc(c.direccion)}</p>
</div>
<div>
<h4>Secciones</h4>
${sections.slice(0, 5).map((s, i) => `<a href="#${i === 0 ? 'servicios' : `seccion-${i}`}">${esc(s.title)}</a>`).join('')}
</div>
</div>
<div class="footer-bottom">© ${new Date().getFullYear()} ${esc(c.titulo)}. Todos los derechos reservados.</div>
</div>
</footer>

<script>
window.addEventListener('scroll',function(){
  document.getElementById('navbar').classList.toggle('scrolled',window.scrollY>50)
});
</script>
</body>
</html>`;
}

export function extractInitialContent(metadata = {}, markdown = "", extraData = {}) {
  const paragraphs = (markdown || "").split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#") && !l.startsWith("!") && !l.startsWith("[") && l.length > 30);
  
  const scrapedSections = extraData.sections || [];
  let sections;
  
  if (scrapedSections.length >= 2) {
    sections = scrapedSections.map(s => ({ title: s.title, body: s.body }));
  } else {
    const titles = ["Nuestros Servicios", "Por Qué Elegirnos", "Nuestro Compromiso"];
    sections = titles.map((t, i) => ({
      title: t,
      body: paragraphs[i] || `Sección de contenido ${i + 1}.`,
    }));
  }

  const originalImages = extraData.images || [];
  const branding = extraData.branding || {};

  return {
    titulo: metadata.title || "Tu título aquí",
    subtitulo: metadata.description || "Subtítulo descriptivo",
    sections: sections.slice(0, 9),
    original_images: originalImages,
    hero_image: metadata.ogImage || originalImages[0] || "",
    logo_url: branding.logo || branding.favicon || metadata.favicon || "",
    brand_colors: branding.colors || {},
    brand_fonts: branding.fonts || [],
    color_primario: "", color_secundario: "",
    cta_texto: "Empezar ahora", cta_url: "#contacto",
    telefono: "+34 600 000 000", email: "hola@tuempresa.com", direccion: "Madrid, España",
  };
}