import express from 'express';
import { supabase } from '../server.js';

const router = express.Router();

// ── Content cleaning ───────────────────────────────────────────────────────
function removeCookieContent(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const cookieRx = /cookie|gdpr|rgpd|privacidad.*aviso|aviso.*legal|política.*privacidad|aceptar.*cookies|rechazar.*cookies|configurar.*cookies|we use cookies|this site uses|consentimiento/i;
  return lines
    .filter(line => !cookieRx.test(line) || line.trim().length < 20)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractSections(markdown) {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    if (h2 || h3) {
      if (current && current.body.trim()) sections.push(current);
      current = { title: (h2 || h3)[1].trim(), body: '', level: h2 ? 2 : 3 };
    } else if (current) {
      const cleaned = line.replace(/^\s*[-*]\s*/, '').trim();
      if (cleaned && !cleaned.startsWith('![') && !cleaned.startsWith('[') && cleaned.length > 5) {
        current.body += (current.body ? ' ' : '') + cleaned;
      }
    }
  }
  if (current && current.body.trim()) sections.push(current);
  return sections.slice(0, 9);
}

function extractImages(html) {
  if (!html) return [];
  const imgs = [];
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const src = match[1];
    if (src.startsWith('http') && !src.includes('pixel') && !src.includes('track') && !src.includes('1x1')) {
      const isIcon = /favicon|\.ico|badge|sprite|avatar/i.test(src);
      if (!isIcon) imgs.push(src);
    }
  }
  return [...new Set(imgs)];
}

// ── Pick best subpages to crawl ────────────────────────────────────────────
const PRIORITY_RX = [
  /\/(nosotros|about|quienes-somos|quien-somos|empresa|about-us|equipo|team)/i,
  /\/(servicios|services|soluciones|solutions)/i,
  /\/(productos|products|catalogo|catalogue|tienda|shop|store)/i,
  /\/(contacto|contact|contactanos|contactame)/i,
  /\/(precios|pricing|tarifas|planes|plans)/i,
  /\/(faq|preguntas|ayuda|help)/i,
];

function pickSubpages(links, baseHostname, mainUrl, max = 6) {
  const internal = links.filter(l => {
    try {
      const u = new URL(l);
      return u.hostname === baseHostname && l !== mainUrl && !l.includes('#')
        && !l.match(/\.(jpg|png|gif|zip|xml|js|css|svg|ico|webp)$/i);
    } catch { return false; }
  });

  const scored = internal.map(l => {
    const score = PRIORITY_RX.findIndex(rx => rx.test(l));
    return { url: l, score: score === -1 ? 99 : score };
  }).sort((a, b) => a.score - b.score);

  return scored.slice(0, max).map(s => s.url);
}

function pickPdfLinks(links, baseHostname) {
  return links.filter(l => {
    try {
      const u = new URL(l);
      return (u.hostname === baseHostname || l.includes('.pdf'))
        && l.match(/\.pdf(\?.*)?$/i);
    } catch { return false; }
  }).slice(0, 3); // max 3 PDFs
}

// ── Single page scrape via Firecrawl ─────────────────────────────────────
async function scrapeSinglePage(url, apiKey, returnLinks = false) {
  try {
    const isPdf = /\.pdf(\?.*)?$/i.test(url);
    const body = isPdf
      ? { url, formats: ['markdown'], waitFor: 2000 }
      : {
          url,
          formats: returnLinks ? ['markdown', 'links'] : ['markdown'],
          onlyMainContent: true,
          excludeTags: ['nav', 'footer', 'header', 'script', 'style', 'noscript',
                        '.cookie-banner', '.cookie-notice', '#cookie-consent',
                        '#cookies', '.gdpr', '[class*="cookie"]', '[id*="cookie"]',
                        '[class*="consent"]', '[id*="consent"]'],
          waitFor: 500,
        };

    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(isPdf ? 20000 : 18000),
    });
    if (!res.ok) return returnLinks ? { markdown: null, links: [] } : null;
    const data = await res.json();
    const markdown = removeCookieContent(data.data?.markdown || '');
    if (returnLinks) return { markdown, links: data.data?.links || [] };
    return markdown;
  } catch {
    return returnLinks ? { markdown: null, links: [] } : null;
  }
}

// POST /api/scrape
router.post('/', async (req, res) => {
  try {
    const { url, proyecto_id } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'FIRECRAWL_API_KEY not configured' });

    // ── Main page scrape (full format for branding/links) ──────────────────
    const mainScrapeBody = {
      url,
      formats: ['markdown', 'html', 'links', 'branding'],
      onlyMainContent: true,
      excludeTags: ['nav', 'footer', 'header', 'script', 'style', 'noscript',
                    '.cookie-banner', '.cookie-notice', '#cookie-consent',
                    '#cookies', '.gdpr', '[class*="cookie"]', '[id*="cookie"]',
                    '[class*="consent"]', '[id*="consent"]'],
      waitFor: 1000,
    };

    let fcRes;
    try {
      fcRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(mainScrapeBody),
        signal: AbortSignal.timeout(25000),
      });
    } catch (e) {
      // Timeout or network error — retry once with minimal params
      try {
        fcRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, formats: ['markdown', 'links'], onlyMainContent: true }),
          signal: AbortSignal.timeout(20000),
        });
      } catch {
        return res.status(504).json({ error: 'La web tardó demasiado en responder. Inténtalo de nuevo o verifica que la URL es accesible.' });
      }
    }

    if (!fcRes.ok) {
      const errText = await fcRes.text().catch(() => fcRes.statusText);
      return res.status(fcRes.status).json({ error: `Error al acceder a la URL (${fcRes.status}). Verifica que la web es pública y accesible.` });
    }

    const fcData = await fcRes.json();
    const data = fcData.data || {};
    const meta = data.metadata || {};
    const branding = data.branding || {};

    // Clean main page markdown
    const mainMarkdown = removeCookieContent(data.markdown || '');

    // ── Detect hostname + internal links ──────────────────────────────────
    let parsedHost = '';
    try { parsedHost = new URL(url).hostname; } catch {}
    const allLinks = data.links || [];
    const subpages = pickSubpages(allLinks, parsedHost, url);

    // ── Level 1: scrape priority subpages (with links to discover level 2) ─
    const level1pages = pickSubpages(allLinks, parsedHost, url, 5);
    const pdfLinksMain = pickPdfLinks(allLinks, parsedHost);

    const level1Results = await Promise.all(
      level1pages.map(link => scrapeSinglePage(link, apiKey, true))
    );

    // ── Level 2: from level 1 pages, discover more internal links ────────
    const level2candidates = new Set();
    for (const r of level1Results) {
      if (!r?.links) continue;
      const l2 = pickSubpages(r.links, parsedHost, url, 3);
      l2.forEach(l => { if (!level1pages.includes(l)) level2candidates.add(l); });
      // Also collect any PDFs found in level 1 pages
      pickPdfLinks(r.links, parsedHost).forEach(p => pdfLinksMain.push(p));
    }
    const level2pages = [...level2candidates].slice(0, 4);

    // ── Level 2 + PDFs scrape in parallel ────────────────────────────────
    const uniquePdfs = [...new Set(pdfLinksMain)].slice(0, 3);
    const level2Results = await Promise.all([
      ...level2pages.map(link => scrapeSinglePage(link, apiKey, false)),
      ...uniquePdfs.map(pdf => scrapeSinglePage(pdf, apiKey, false)),
    ]);

    // ── Combine all content ───────────────────────────────────────────────
    const allPages = [
      ...level1pages.map((url, i) => ({ url, md: level1Results[i]?.markdown })),
      ...level2pages.map((url, i) => ({ url, md: level2Results[i] })),
      ...uniquePdfs.map((url, i) => ({ url, md: level2Results[level2pages.length + i], isPdf: true })),
    ];

    const subMarkdown = allPages
      .filter(p => p.md)
      .map(p => `\n\n--- ${p.isPdf ? '📄 PDF: ' : ''}${p.url} ---\n${p.md}`)
      .join('');

    const combinedMarkdown = (mainMarkdown + subMarkdown)
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Total cap at 12000 chars (more content = better chatbot knowledge)
    const finalMarkdown = combinedMarkdown.slice(0, 12000);
    const pagesCrawled = [url,
      ...level1pages.filter((_, i) => level1Results[i]?.markdown),
      ...level2pages.filter((_, i) => level2Results[i]),
      ...uniquePdfs.filter((_, i) => level2Results[level2pages.length + i]),
    ];

    const sections = extractSections(mainMarkdown);
    const images = extractImages(data.html || '');
    const brandLogo = branding.logo || branding.images?.logo || '';
    const brandFavicon = branding.images?.favicon || meta.favicon || '';
    const brandColors = branding.colors || {};

    const pageLinks = allLinks
      .filter(l => { try { return new URL(l).hostname === parsedHost && l !== url && !l.includes('#'); } catch { return false; } })
      .slice(0, 12);

    const rawHtml = (data.html || '').toLowerCase();
    const rawMarkdown = finalMarkdown.toLowerCase();
    const combined = rawHtml + ' ' + rawMarkdown;

    let tiene_ecommerce = false;
    let plataforma_ecommerce = null;
    if (/woocommerce|wc-cart|wc-block/i.test(rawHtml)) { tiene_ecommerce = true; plataforma_ecommerce = 'woocommerce'; }
    else if (/shopify|cdn\.shopify\.com/i.test(rawHtml)) { tiene_ecommerce = true; plataforma_ecommerce = 'shopify'; }
    else if (/prestashop|presta-shop/i.test(rawHtml)) { tiene_ecommerce = true; plataforma_ecommerce = 'prestashop'; }
    else if (/add.to.cart|carrito|cesta|comprar|checkout/i.test(combined)) { tiene_ecommerce = true; plataforma_ecommerce = 'otro'; }

    const result = {
      markdown: finalMarkdown,
      sections,
      images,
      branding: {
        logo: brandLogo,
        favicon: brandFavicon,
        colors: {
          primary: brandColors.primary || '',
          secondary: brandColors.secondary || '',
          accent: brandColors.accent || '',
          background: brandColors.background || '',
          text: brandColors.textPrimary || '',
        },
        fonts: (branding.fonts || []).map(f => f.family).filter(Boolean),
      },
      metadata: {
        title: meta.title || meta.ogTitle || '',
        description: meta.description || meta.ogDescription || '',
        ogImage: meta.ogImage || '',
        favicon: meta.favicon || '',
        language: meta.language || 'es',
        url: meta.sourceURL || url,
        tiene_ecommerce,
        plataforma_ecommerce,
        pages_crawled: pagesCrawled,
      },
    };

    if (proyecto_id) {
      await supabase.from('proyectos').update({
        metadata_scrapeado: result.metadata,
        contenido_scrapeado: finalMarkdown,
        estado: 'revision',
      }).eq('id', proyecto_id);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
