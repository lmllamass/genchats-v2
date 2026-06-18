import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── PrestaShop ───
// API: GET /api/products?output_format=JSON&display=[id,name,price,quantity,id_category_default]
// Auth: Basic auth with API key as username, blank password
// Categories: GET /api/categories?output_format=JSON&display=[id,name]
// Images: /api/images/products/{id}
async function queryPrestaShop(config, query) {
  const { store_url, api_key } = config;
  const base = store_url.replace(/\/+$/, '');
  const auth = btoa(`${api_key}:`);
  const headers = { 'Authorization': `Basic ${auth}` };

  // If querying by category name, first resolve category id
  let categoryFilter = '';
  if (query.category) {
    const catRes = await fetch(`${base}/api/categories?output_format=JSON&display=[id,name]&filter[name]=[${query.category}]%`, { headers });
    if (catRes.ok) {
      const catData = await catRes.json();
      const cats = catData.categories || [];
      if (cats.length > 0) {
        categoryFilter = `&filter[id_category_default]=[${cats[0].id}]`;
      }
    }
  }

  let searchFilter = '';
  if (query.search) {
    searchFilter = `&filter[name]=[${query.search}]%`;
  }

  const url = `${base}/api/products?output_format=JSON&display=[id,name,price,quantity,id_category_default,id_default_image]${searchFilter}${categoryFilter}&limit=10`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`PrestaShop API error: ${res.status}`);
  const data = await res.json();

  return (data.products || []).map(p => ({
    id: p.id,
    name: typeof p.name === 'object' ? (p.name[1] || Object.values(p.name)[0]) : p.name,
    price: p.price,
    stock: p.quantity,
    image: p.id_default_image ? `${base}/api/images/products/${p.id}/${p.id_default_image}?ws_key=${api_key}` : null,
    category_id: p.id_category_default,
  }));
}

async function getPrestaShopCategories(config) {
  const base = config.store_url.replace(/\/+$/, '');
  const auth = btoa(`${config.api_key}:`);
  const res = await fetch(`${base}/api/categories?output_format=JSON&display=[id,name,active]&filter[active]=[1]`, {
    headers: { 'Authorization': `Basic ${auth}` }
  });
  if (!res.ok) throw new Error(`PrestaShop categories error: ${res.status}`);
  const data = await res.json();
  return (data.categories || []).map(c => ({
    id: c.id,
    name: typeof c.name === 'object' ? (c.name[1] || Object.values(c.name)[0]) : c.name,
  }));
}

// ─── WooCommerce ───
// API: GET /wp-json/wc/v3/products?consumer_key=X&consumer_secret=Y
// Auth: Query params or Basic auth
// Categories: GET /wp-json/wc/v3/products/categories
async function queryWooCommerce(config, query) {
  const { store_url, api_key, api_secret } = config;
  const base = store_url.replace(/\/+$/, '');
  const authParams = `consumer_key=${api_key}&consumer_secret=${api_secret}`;

  let filters = '';
  if (query.search) filters += `&search=${encodeURIComponent(query.search)}`;
  if (query.category_id) filters += `&category=${query.category_id}`;

  // If category name given, resolve id first
  if (query.category && !query.category_id) {
    const catRes = await fetch(`${base}/wp-json/wc/v3/products/categories?${authParams}&search=${encodeURIComponent(query.category)}&per_page=5`);
    if (catRes.ok) {
      const cats = await catRes.json();
      if (cats.length > 0) filters += `&category=${cats[0].id}`;
    }
  }

  const url = `${base}/wp-json/wc/v3/products?${authParams}${filters}&per_page=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WooCommerce API error: ${res.status}`);
  const products = await res.json();

  return products.map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    regular_price: p.regular_price,
    sale_price: p.sale_price,
    stock: p.stock_quantity,
    in_stock: p.in_stock,
    image: p.images?.[0]?.src || null,
    categories: (p.categories || []).map(c => c.name),
    short_description: (p.short_description || '').replace(/<[^>]*>/g, '').slice(0, 200),
  }));
}

async function getWooCommerceCategories(config) {
  const base = config.store_url.replace(/\/+$/, '');
  const authParams = `consumer_key=${config.api_key}&consumer_secret=${config.api_secret}`;
  const res = await fetch(`${base}/wp-json/wc/v3/products/categories?${authParams}&per_page=50`);
  if (!res.ok) throw new Error(`WooCommerce categories error: ${res.status}`);
  const cats = await res.json();
  return cats.map(c => ({ id: c.id, name: c.name, count: c.count }));
}

// ─── Shopify ───
// API: GET /admin/api/2024-01/products.json
// Auth: X-Shopify-Access-Token header
async function queryShopify(config, query) {
  const { store_url, api_key } = config;
  const base = store_url.replace(/\/+$/, '');
  const headers = { 'X-Shopify-Access-Token': api_key, 'Content-Type': 'application/json' };

  let filters = '';
  if (query.search) filters += `&title=${encodeURIComponent(query.search)}`;
  if (query.collection_id) filters += `&collection_id=${query.collection_id}`;

  const url = `${base}/admin/api/2024-01/products.json?limit=10${filters}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);
  const data = await res.json();

  // If category search, first get collection id
  if (query.category && !query.collection_id) {
    const colRes = await fetch(`${base}/admin/api/2024-01/custom_collections.json?title=${encodeURIComponent(query.category)}`, { headers });
    if (colRes.ok) {
      const colData = await colRes.json();
      if (colData.custom_collections?.length > 0) {
        const colId = colData.custom_collections[0].id;
        const prodRes = await fetch(`${base}/admin/api/2024-01/products.json?collection_id=${colId}&limit=10`, { headers });
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          return prodData.products.map(formatShopifyProduct);
        }
      }
    }
  }

  return (data.products || []).map(formatShopifyProduct);
}

function formatShopifyProduct(p) {
  const variant = p.variants?.[0] || {};
  return {
    id: p.id,
    name: p.title,
    price: variant.price,
    stock: variant.inventory_quantity,
    in_stock: variant.inventory_quantity > 0,
    image: p.image?.src || p.images?.[0]?.src || null,
    description: (p.body_html || '').replace(/<[^>]*>/g, '').slice(0, 200),
  };
}

async function getShopifyCategories(config) {
  const base = config.store_url.replace(/\/+$/, '');
  const headers = { 'X-Shopify-Access-Token': config.api_key };
  const res = await fetch(`${base}/admin/api/2024-01/custom_collections.json?limit=50`, { headers });
  if (!res.ok) throw new Error(`Shopify collections error: ${res.status}`);
  const data = await res.json();
  return (data.custom_collections || []).map(c => ({ id: c.id, name: c.title }));
}

// ─── Odoo ───
// API: JSON-RPC 2.0 at /jsonrpc
// Auth: authenticate then search_read on product.template
async function odooRpc(base, method, params) {
  const res = await fetch(`${base}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params })
  });
  if (!res.ok) throw new Error(`Odoo RPC error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Odoo error');
  return data.result;
}

async function odooAuthenticate(config) {
  const base = config.store_url.replace(/\/+$/, '');
  const uid = await odooRpc(base, 'call', {
    service: 'common', method: 'authenticate',
    args: [config.odoo_db, config.odoo_username, config.odoo_password, {}]
  });
  return { base, uid };
}

async function queryOdoo(config, query) {
  const { base, uid } = await odooAuthenticate(config);
  const domain = [['sale_ok', '=', true]];
  if (query.search) domain.push(['name', 'ilike', query.search]);
  if (query.category_id) domain.push(['categ_id', '=', parseInt(query.category_id)]);
  if (query.category) domain.push(['categ_id.name', 'ilike', query.category]);

  const products = await odooRpc(base, 'call', {
    service: 'object', method: 'execute_kw',
    args: [config.odoo_db, uid, config.odoo_password, 'product.template', 'search_read',
      [domain],
      { fields: ['id', 'name', 'list_price', 'qty_available', 'categ_id', 'image_1920'], limit: 10 }
    ]
  });

  return (products || []).map(p => ({
    id: p.id,
    name: p.name,
    price: p.list_price,
    stock: p.qty_available,
    image: p.image_1920 ? `data:image/png;base64,${p.image_1920}` : null,
    category: p.categ_id?.[1] || null,
  }));
}

async function getOdooCategories(config) {
  const { base, uid } = await odooAuthenticate(config);
  const cats = await odooRpc(base, 'call', {
    service: 'object', method: 'execute_kw',
    args: [config.odoo_db, uid, config.odoo_password, 'product.category', 'search_read',
      [[]],
      { fields: ['id', 'name'], limit: 50 }
    ]
  });
  return (cats || []).map(c => ({ id: c.id, name: c.name }));
}

// ─── Ferreteria1.app ───
// API: POST /functions/chatbotProductSearch
// Auth: Bearer token in Authorization header
// Supports: text search (q), SKU search (sku), EAN search (ean)
async function queryFerreteria1(config, query) {
  const headers = {
    'Authorization': `Bearer ${config.api_key}`,
    'Content-Type': 'application/json'
  };

  const body = {
    ferreteria_id: config.ferreteria_id,
    tenant_slug: config.tenant_slug,
    limit: 10
  };

  // Detect if the search is a SKU, EAN or text
  if (query.search) {
    const trimmed = query.search.trim();
    if (/^\d{13}$/.test(trimmed)) {
      body.ean = trimmed;
    } else if (/^[A-Z0-9]{3,10}$/i.test(trimmed) && trimmed.length <= 10) {
      body.sku = trimmed;
    } else {
      body.q = trimmed;
    }
  }
  if (query.category) {
    body.q = (body.q ? body.q + ' ' : '') + query.category;
  }

  const res = await fetch('https://ferreteria1.com/functions/chatbotProductSearch', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Ferreteria1 API error: ${res.status}`);
  const data = await res.json();

  if (!data.success) throw new Error(data.error || 'Ferreteria1 search failed');

  return (data.products || []).map(p => ({
    id: p.sku || p.ean,
    name: p.name,
    brand: p.brand || null,
    price: p.price_available ? p.price : null,
    price_available: p.price_available,
    stock: p.stock_available ? p.stock : null,
    stock_available: p.stock_available,
    in_stock: p.stock_available ? (p.stock > 0) : undefined,
    image: p.image || null,
    category: p.category || null,
    description: p.description ? p.description.slice(0, 200) : null,
    sku: p.sku,
    ean: p.ean,
    unit: p.unit || null,
    url: p.url || null,
    source: p.source || 'local',
  }));
}

// Ferreteria1 doesn't have a dedicated categories endpoint, return empty
async function getFerreteria1Categories() {
  return [];
}

// ─── Google Sheets ───
// Reads a public Google Sheet exported as CSV
// Expected columns: nombre, precio, stock, categoría, url, descripción, sku, marca
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  // Parse header row — handle quoted fields
  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function queryGoogleSheets(config, query) {
  const sheetId = extractSheetId(config.sheet_url || '');
  if (!sheetId) throw new Error('Invalid Google Sheets URL');

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error(`Google Sheets fetch error: ${res.status}. Make sure the sheet is public.`);
  const text = await res.text();
  const rows = parseCSV(text);

  // Map rows to product objects
  let products = rows.map(r => ({
    name: r.nombre || r.name || r.producto || '',
    price: r.precio || r.price || null,
    stock: r.stock || r.cantidad || r.inventory || null,
    category: r.categoria || r.category || null,
    url: r.url || r.enlace || r.link || null,
    description: r.descripcion || r.description || null,
    sku: r.sku || r.referencia || r.ref || null,
    brand: r.marca || r.brand || null,
  })).filter(p => p.name);

  // Apply search filter
  if (query.search) {
    const s = query.search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(s) ||
      (p.description && p.description.toLowerCase().includes(s)) ||
      (p.sku && p.sku.toLowerCase().includes(s)) ||
      (p.brand && p.brand.toLowerCase().includes(s))
    );
  }

  // Apply category filter
  if (query.category) {
    const c = query.category.toLowerCase();
    products = products.filter(p => p.category && p.category.toLowerCase().includes(c));
  }

  return products.slice(0, 15);
}

async function getGoogleSheetsCategories(config) {
  const sheetId = extractSheetId(config.sheet_url || '');
  if (!sheetId) return [];

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const res = await fetch(csvUrl);
  if (!res.ok) return [];
  const text = await res.text();
  const rows = parseCSV(text);

  const cats = new Set();
  rows.forEach(r => {
    const cat = r.categoria || r.category || '';
    if (cat) cats.add(cat);
  });
  return Array.from(cats).map(name => ({ name }));
}

// ─── Main handler ───
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req, { forceServiceRole: true });
    const { proyecto_id, action, search, category, category_id } = await req.json();

    if (!proyecto_id) return Response.json({ error: 'proyecto_id is required' }, { status: 400 });

    const proyecto = await base44.asServiceRole.entities.Proyecto.get(proyecto_id);
    const econfig = proyecto?.ecommerce_config;

    if (!econfig?.enabled || !econfig?.platform) {
      return Response.json({ error: 'Ecommerce not configured', products: [], categories: [] });
    }

    const query = { search, category, category_id };

    // Action: "categories" or "products" (default)
    if (action === 'categories') {
      let categories = [];
      switch (econfig.platform) {
        case 'ferreteria1': categories = await getFerreteria1Categories(); break;
        case 'prestashop': categories = await getPrestaShopCategories(econfig); break;
        case 'woocommerce': categories = await getWooCommerceCategories(econfig); break;
        case 'shopify': categories = await getShopifyCategories(econfig); break;
        case 'odoo': categories = await getOdooCategories(econfig); break;
        case 'googlesheets': categories = await getGoogleSheetsCategories(econfig); break;
      }
      return Response.json({ categories });
    }

    let products = [];
    switch (econfig.platform) {
      case 'ferreteria1': products = await queryFerreteria1(econfig, query); break;
      case 'prestashop': products = await queryPrestaShop(econfig, query); break;
      case 'woocommerce': products = await queryWooCommerce(econfig, query); break;
      case 'shopify': products = await queryShopify(econfig, query); break;
      case 'odoo': products = await queryOdoo(econfig, query); break;
      case 'googlesheets': products = await queryGoogleSheets(econfig, query); break;
    }

    return Response.json({ products });
  } catch (error) {
    console.error('queryProducts error:', error.message);
    return Response.json({ error: error.message, products: [] }, { status: 500 });
  }
});