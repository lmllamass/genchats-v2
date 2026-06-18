import express from 'express';

const router = express.Router();

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
  const headers = parseRow(lines[0]).map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
  return lines.slice(1).map(line => {
    const values = parseRow(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

// POST /api/products/query
router.post('/query', async (req, res) => {
  try {
    const { ecommerce_config, action, search, category, limit = 15 } = req.body;
    if (!ecommerce_config?.enabled || !ecommerce_config?.platform) {
      return res.json({ products: [], categories: [] });
    }

    if (ecommerce_config.platform === 'googlesheets') {
      const match = (ecommerce_config.sheet_url || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (!match) return res.json({ products: [], categories: [] });

      const csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
      const fetchRes = await fetch(csvUrl);
      if (!fetchRes.ok) return res.json({ products: [], categories: [] });

      let rows = parseCSV(await fetchRes.text());
      const products = rows.map(r => ({
        name: r.nombre || r.name || r.producto || '',
        price: r.precio || r.price || null,
        stock: r.stock || r.cantidad || null,
        category: r.categoria || r.category || null,
        url: r.url || r.enlace || null,
        description: r.descripcion || r.description || null,
        sku: r.sku || r.referencia || null,
        brand: r.marca || r.brand || null,
      })).filter(p => p.name);

      if (action === 'categories') {
        const cats = new Set(rows.map(r => r.categoria || r.category || '').filter(Boolean));
        return res.json({ categories: [...cats].map(name => ({ name })) });
      }

      let filtered = products;
      if (search) { const s = search.toLowerCase(); filtered = filtered.filter(p => p.name.toLowerCase().includes(s) || (p.description && p.description.toLowerCase().includes(s))); }
      if (category) { const c = category.toLowerCase(); filtered = filtered.filter(p => p.category && p.category.toLowerCase().includes(c)); }

      return res.json({ products: filtered.slice(0, limit) });
    }

    res.json({ products: [], categories: [], message: 'Platform not supported yet' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
