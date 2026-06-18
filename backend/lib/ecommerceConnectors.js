/**
 * E-commerce platform connectors
 * Each returns: { products: [{name, price, stock, url, sku, category, description}] }
 *               or { categories: [{name, id}] }
 */

// ── Google Sheets ──────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const parseRow = (line) => {
    const result = []; let current = ''; let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += ch;
    }
    result.push(current.trim());
    return result;
  };
  const headers = parseRow(lines[0]).map(h =>
    h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  );
  return lines.slice(1).map(line => {
    const values = parseRow(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

async function queryGoogleSheets(config, { query = '', category = '', action = 'products' }) {
  const match = (config.sheet_url || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error('URL de Google Sheets inválida');

  const csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
  const res = await fetch(csvUrl, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('No se pudo acceder a la Google Sheet');

  const rows = parseCSV(await res.text());
  let products = rows.map(r => ({
    name: r.nombre || r.name || r.producto || r.product || '',
    price: r.precio || r.price || r.pvp || null,
    stock: r.stock || r.cantidad || r.quantity || null,
    category: r.categoria || r.category || null,
    url: r.url || r.enlace || r.link || null,
    description: r.descripcion || r.description || null,
    sku: r.sku || r.referencia || r.ref || null,
  })).filter(p => p.name);

  if (action === 'categories') {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    return { categories: cats.map(name => ({ name })) };
  }

  if (query) {
    const q = query.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  }
  if (category) {
    const c = category.toLowerCase();
    products = products.filter(p => p.category && p.category.toLowerCase().includes(c));
  }

  return { products: products.slice(0, 15) };
}

// ── WooCommerce ────────────────────────────────────────────────────────────
async function queryWooCommerce(config, { query = '', category = '', action = 'products' }) {
  const { store_url, api_key, api_secret } = config;
  if (!store_url || !api_key) throw new Error('WooCommerce: faltan credenciales');

  const auth = Buffer.from(`${api_key}:${api_secret || ''}`).toString('base64');
  const base = store_url.replace(/\/$/, '');

  if (action === 'categories') {
    const res = await fetch(`${base}/wp-json/wc/v3/products/categories?per_page=50`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`WooCommerce error ${res.status}`);
    const cats = await res.json();
    return { categories: cats.map(c => ({ name: c.name, id: c.id })) };
  }

  const params = new URLSearchParams({ per_page: '15', status: 'publish' });
  if (query) params.set('search', query);
  if (category) params.set('category', category);

  const res = await fetch(`${base}/wp-json/wc/v3/products?${params}`, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`WooCommerce error ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(data?.message || 'WooCommerce: respuesta inesperada');

  return {
    products: data.map(p => ({
      name: p.name,
      price: p.sale_price || p.price,
      stock: p.stock_status === 'instock'
        ? (p.stock_quantity != null ? `${p.stock_quantity} en stock` : 'En stock')
        : 'Sin stock',
      url: p.permalink,
      sku: p.sku,
      category: p.categories?.[0]?.name || null,
      description: p.short_description?.replace(/<[^>]*>/g, '').slice(0, 120) || null,
    })),
  };
}

// ── Shopify (Storefront API) ───────────────────────────────────────────────
async function queryShopify(config, { query = '', category = '', action = 'products' }) {
  const { store_url, api_key } = config;
  if (!store_url || !api_key) throw new Error('Shopify: faltan credenciales');

  const base = store_url.replace(/\/$/, '');
  const endpoint = `${base}/api/2024-01/graphql.json`;
  const headers = {
    'X-Shopify-Access-Token': api_key,
    'Content-Type': 'application/json',
  };

  if (action === 'categories') {
    const gql = `{ collections(first:50){edges{node{title handle}}} }`;
    const res = await fetch(endpoint, {
      method: 'POST', headers,
      body: JSON.stringify({ query: gql }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const cols = data.data?.collections?.edges || [];
    return { categories: cols.map(({ node: c }) => ({ name: c.title, id: c.handle })) };
  }

  const searchQuery = [query, category ? `product_type:${category}` : ''].filter(Boolean).join(' ');
  const gql = `
    query($q: String!) {
      products(first: 15, query: $q) {
        edges {
          node {
            title
            handle
            description
            productType
            priceRange { minVariantPrice { amount currencyCode } }
            variants(first:1) { edges { node { sku availableForSale } } }
            onlineStoreUrl
          }
        }
      }
    }`;

  const res = await fetch(endpoint, {
    method: 'POST', headers,
    body: JSON.stringify({ query: gql, variables: { q: searchQuery } }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  const edges = data.data?.products?.edges || [];

  return {
    products: edges.map(({ node: p }) => ({
      name: p.title,
      price: `${parseFloat(p.priceRange.minVariantPrice.amount).toFixed(2)} ${p.priceRange.minVariantPrice.currencyCode}`,
      stock: p.variants?.edges?.[0]?.node?.availableForSale ? 'En stock' : 'Sin stock',
      url: p.onlineStoreUrl || `${base}/products/${p.handle}`,
      sku: p.variants?.edges?.[0]?.node?.sku || null,
      category: p.productType || null,
      description: p.description?.slice(0, 120) || null,
    })),
  };
}

// ── PrestaShop ─────────────────────────────────────────────────────────────
async function queryPrestaShop(config, { query = '', category = '', action = 'products' }) {
  const { store_url, api_key } = config;
  if (!store_url || !api_key) throw new Error('PrestaShop: faltan credenciales');

  const base = store_url.replace(/\/$/, '');
  const auth = Buffer.from(`${api_key}:`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, Accept: 'application/json' };

  if (action === 'categories') {
    const res = await fetch(
      `${base}/api/categories?output_format=JSON&display=[id,name]&limit=50`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    return {
      categories: (data.categories || []).map(c => ({
        name: Array.isArray(c.name) ? c.name[0]?.value : c.name,
        id: c.id,
      })).filter(c => c.name),
    };
  }

  const params = new URLSearchParams({
    output_format: 'JSON',
    display: '[id,name,price,quantity,description_short,link_rewrite]',
    limit: '15',
  });
  if (query) params.set('filter[name]', `%[${query}]%`);

  const res = await fetch(`${base}/api/products?${params}`, {
    headers, signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();

  return {
    products: (data.products || []).map(p => {
      const name = Array.isArray(p.name) ? p.name[0]?.value : p.name;
      const desc = Array.isArray(p.description_short)
        ? p.description_short[0]?.value
        : p.description_short;
      return {
        name,
        price: `${parseFloat(p.price || 0).toFixed(2)}€`,
        stock: (p.quantity || 0) > 0 ? `${p.quantity} en stock` : 'Sin stock',
        url: p.link_rewrite ? `${base}/${p.link_rewrite}` : null,
        description: desc?.replace(/<[^>]*>/g, '').slice(0, 120) || null,
      };
    }).filter(p => p.name),
  };
}

// ── Odoo ───────────────────────────────────────────────────────────────────
async function queryOdoo(config, { query = '', category = '', action = 'products' }) {
  const { store_url, odoo_db, odoo_username, odoo_password } = config;
  if (!store_url || !odoo_db || !odoo_username) throw new Error('Odoo: faltan credenciales');

  const base = store_url.replace(/\/$/, '');
  const rpc = async (model, method, args, kwargs = {}) => {
    const res = await fetch(`${base}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'call', id: Date.now(),
        params: { model, method, args, kwargs },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.data?.message || 'Odoo RPC error');
    return data.result;
  };

  // Authenticate
  const uid = await rpc('res.users', 'authenticate', [odoo_db, odoo_username, odoo_password, {}]);
  if (!uid) throw new Error('Odoo: credenciales incorrectas');

  if (action === 'categories') {
    const cats = await rpc('product.category', 'search_read', [[]], {
      fields: ['name', 'id'], limit: 50,
    });
    return { categories: cats.map(c => ({ name: c.name, id: c.id })) };
  }

  const domain = [];
  if (query) domain.push(['name', 'ilike', query]);
  if (category) domain.push(['categ_id.name', 'ilike', category]);

  const products = await rpc('product.template', 'search_read', [domain], {
    fields: ['name', 'list_price', 'qty_available', 'description_sale', 'categ_id', 'default_code'],
    limit: 15,
    context: { lang: 'es_ES' },
  });

  return {
    products: products.map(p => ({
      name: p.name,
      price: `${parseFloat(p.list_price || 0).toFixed(2)}€`,
      stock: (p.qty_available || 0) > 0 ? `${Math.floor(p.qty_available)} en stock` : 'Sin stock',
      sku: p.default_code || null,
      category: Array.isArray(p.categ_id) ? p.categ_id[1] : null,
      description: p.description_sale?.slice(0, 120) || null,
    })),
  };
}

// ── Ferreteria1 ───────────────────────────────────────────────────────────
/**
 * Conector para Ferreteria1.app (plataforma Base44).
 * Usa el endpoint público: POST https://ferreteria1.com/functions/whatsappProductSearch
 * - Busca en el catálogo propio del tenant (source: local) + 600k productos Daterium.
 * - La URL de producto se adapta al dominio del tenant (store_url).
 */
const FERRETERIA1_SEARCH_URL = 'https://ferreteria1.com/functions/whatsappProductSearch';

// Categorías principales de ferretería para cuando se piden categorías
const FERRETERIA1_CATEGORIES = [
  'Herramientas manuales', 'Herramientas eléctricas', 'Tornillería y fijaciones',
  'Pintura y accesorios', 'Fontanería', 'Electricidad e iluminación',
  'Construcción y morteros', 'Soldadura', 'Seguridad y EPI',
  'Jardín y exterior', 'Abrasivos y discos de corte', 'Adhesivos y selladores',
  'Almacenaje y organización', 'Neumática e hidráulica', 'Climatización',
];

async function queryFerreteria1(config, { query = '', category = '', action = 'products' }) {
  const { api_key, ferreteria_id, store_url, tenant_slug } = config;

  // Determinar la base URL del tenant para los enlaces de producto
  const tenantBase = (store_url || (tenant_slug ? `https://${tenant_slug}.ferreteria1.app` : 'https://ferreteria1.com')).replace(/\/$/, '');

  if (action === 'categories') {
    return {
      categories: FERRETERIA1_CATEGORIES.map(name => ({ name })),
    };
  }

  // Construir el body de búsqueda
  const searchTerm = [query, category].filter(Boolean).join(' ').trim();
  if (!searchTerm) {
    return { products: [], message: 'Indica un producto o término para buscar en el catálogo.' };
  }

  const body = { search: searchTerm, limit: 8 };
  if (ferreteria_id) body.ferreteria_id = ferreteria_id;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Ferreteria1 timeout')), 15000);

  let data;
  try {
    const res = await fetch(FERRETERIA1_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(api_key ? { Authorization: `Bearer ${api_key}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Ferreteria1 API ${res.status}`);
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }

  if (!data.success) {
    throw new Error(data.message || 'Error en la búsqueda de Ferreteria1');
  }

  const products = (data.products || []).map(p => {
    // Reescribir la URL del producto al dominio del tenant si es distinto
    let url = p.product_url || null;
    if (url && tenantBase !== 'https://ferreteria1.com') {
      url = url.replace('https://ferreteria1.com', tenantBase);
    }
    return {
      name: p.name || '',
      price: p.price != null
        ? `${parseFloat(p.price).toFixed(2)}€`
        : (p.price_formatted !== 'Consultar' ? p.price_formatted : null),
      stock: p.price != null ? 'Disponible' : 'Consultar precio',
      sku: p.sku || p.id || null,
      brand: p.brand || null,
      category: null,
      description: null,
      url,
    };
  }).filter(p => p.name);

  // Añadir enlace al catálogo completo si hay resultados
  if (data.catalog_url && tenantBase !== 'https://ferreteria1.com') {
    data.catalog_url = data.catalog_url.replace('https://ferreteria1.com', tenantBase);
  }

  return {
    products,
    catalog_url: data.catalog_url || null,
    total: data.total || products.length,
  };
}

// ── Router ─────────────────────────────────────────────────────────────────
export async function queryEcommerce(proyecto, toolInput) {
  const econfig = proyecto.ecommerce_config || {};
  const platform = econfig.platform;
  const action = toolInput.accion || 'products';
  const params = { query: toolInput.consulta || '', category: toolInput.categoria || '', action };

  switch (platform) {
    case 'googlesheets': return queryGoogleSheets(econfig, params);
    case 'woocommerce':  return queryWooCommerce(econfig, params);
    case 'shopify':      return queryShopify(econfig, params);
    case 'prestashop':   return queryPrestaShop(econfig, params);
    case 'odoo':         return queryOdoo(econfig, params);
    case 'ferreteria1':  return queryFerreteria1(econfig, params);
    default:
      return { products: [], message: `Plataforma "${platform}" no soportada todavía.` };
  }
}

// Format product results as readable text for the assistant.
// Uses plain URLs (not markdown links) so they survive WhatsApp/Telegram formatting
// and are auto-linked in every channel.
export function formatProducts(result) {
  if (result.categories?.length) {
    return `Categorías disponibles:\n${result.categories.map(c => `• ${c.name}`).join('\n')}`;
  }

  // ── Sin resultados ──────────────────────────────────────────────────────
  if (!result.products?.length) {
    let msg = 'No se encontraron productos exactos para esa búsqueda.';
    if (result.catalog_url) {
      msg += `\nPuedes explorar el catálogo completo aquí:\n${result.catalog_url}`;
    }
    return msg;
  }

  // ── Con resultados ──────────────────────────────────────────────────────
  const lines = result.products.map(p => {
    const parts = [`• **${p.name}**`];
    if (p.brand)       parts.push(`(${p.brand})`);
    if (p.price)       parts.push(`— ${p.price}`);
    if (p.stock)       parts.push(`| ${p.stock}`);
    if (p.sku)         parts.push(`| Ref: ${p.sku}`);
    if (p.description) parts.push(`\n  ${p.description}`);
    // URL en línea propia, sin markdown → auto-linked en WhatsApp, Telegram y web
    if (p.url)         parts.push(`\n  👉 ${p.url}`);
    return parts.join(' ');
  }).join('\n\n');

  const extra = [];
  if (result.total && result.total > result.products.length) {
    extra.push(`\n(Mostrando ${result.products.length} de ${result.total} resultados)`);
  }
  if (result.catalog_url) {
    extra.push(`\nCatálogo completo: ${result.catalog_url}`);
  }

  return lines + extra.join('');
}
