import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
    if (src.startsWith('http') && !src.includes('pixel') && !src.includes('track') && !src.includes('1x1') && !src.includes('spacer')) {
      const isIcon = /favicon|\.ico|badge|sprite|avatar/i.test(src);
      if (!isIcon) imgs.push(src);
    }
  }
  return [...new Set(imgs)];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { url, proyecto_id } = await req.json();
    if (!url) return Response.json({ error: 'url is required' }, { status: 400 });

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) return Response.json({ error: 'FIRECRAWL_API_KEY not configured' }, { status: 500 });

    // Use v2 API with branding + markdown + html formats for maximum data extraction
    const fcRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html', 'links', 'branding'],
        onlyMainContent: false,
      }),
    });

    if (!fcRes.ok) {
      const errText = await fcRes.text();
      return Response.json({ error: `Firecrawl error: ${errText}` }, { status: fcRes.status });
    }

    const fcData = await fcRes.json();
    const data = fcData.data || {};
    const meta = data.metadata || {};
    const branding = data.branding || {};

    // Extract sections from markdown
    const sections = extractSections(data.markdown || '');

    // Extract real images from HTML
    const images = extractImages(data.html || '');

    // Get branding data — logo, colors, fonts
    const brandLogo = branding.logo || branding.images?.logo || '';
    const brandFavicon = branding.images?.favicon || meta.favicon || '';
    const brandColors = branding.colors || {};

    // Get links from the page (firecrawl returns them clean)
    // Only keep internal links from the same domain
    let parsedHost = '';
    try { parsedHost = new URL(url).hostname; } catch(e) { /* ignore */ }
    
    const pageLinks = (data.links || [])
      .filter(l => {
        if (!l || typeof l !== 'string') return false;
        // Only keep absolute URLs from the same domain
        try {
          const linkHost = new URL(l).hostname;
          return linkHost === parsedHost && l !== url && !l.includes('#');
        } catch(e) { return false; }
      })
      .slice(0, 12);

    const markdown = (data.markdown || '').slice(0, 3000);
    const rawHtml = (data.html || '').toLowerCase();
    const rawMarkdown = (data.markdown || '').toLowerCase();
    const combined = rawHtml + ' ' + rawMarkdown;

    // Ecommerce detection
    let tiene_ecommerce = false;
    let plataforma_ecommerce = null;

    if (/woocommerce|wc-cart|wc-block|class="woocommerce"/i.test(rawHtml)) {
      tiene_ecommerce = true; plataforma_ecommerce = 'woocommerce';
    } else if (/shopify|cdn\.shopify\.com|shopify-section/i.test(rawHtml)) {
      tiene_ecommerce = true; plataforma_ecommerce = 'shopify';
    } else if (/prestashop|presta-shop|addtocart|id_product/i.test(rawHtml)) {
      tiene_ecommerce = true; plataforma_ecommerce = 'prestashop';
    } else if (/add.to.cart|carrito|cesta|comprar|a[ñn]adir.al.carrito|checkout|precio|price|tienda.online|shop.now/i.test(combined)) {
      tiene_ecommerce = true; plataforma_ecommerce = 'otro';
    }

    const result = {
      markdown,
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
      },
    };

    if (proyecto_id) {
      await base44.entities.Proyecto.update(proyecto_id, {
        metadata_scrapeado: result.metadata,
        estado: 'revision',
      });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});