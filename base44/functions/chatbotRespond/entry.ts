import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function formatProductsForChat(products) {
  if (!products || products.length === 0) return "No se encontraron productos.";
  return products.map(p => {
    let text = `• **${p.name}**`;
    if (p.brand) text += ` (${p.brand})`;
    if (p.price_available === false) text += ` — Consultar precio`;
    else if (p.price) text += ` — ${p.price}€`;
    if (p.stock !== undefined && p.stock !== null) text += ` | Stock: ${p.stock > 0 ? p.stock : 'Agotado'}`;
    if (p.sku) text += ` | SKU: ${p.sku}`;
    if (p.category) text += ` | Cat: ${p.category}`;
    if (p.url) text += ` | [Ver](${p.url})`;
    return text;
  }).join('\n');
}

// ─── Inline product query ───
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const parseRow = (line) => {
    const result = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += ch;
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

async function queryGoogleSheetsInline(econfig, query) {
  const sheetId = extractSheetId(econfig.sheet_url || '');
  if (!sheetId) return [];
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const res = await fetch(csvUrl);
  if (!res.ok) return [];
  const text = await res.text();
  const rows = parseCSV(text);
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
  if (query.search) {
    const s = query.search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(s) ||
      (p.description && p.description.toLowerCase().includes(s)) ||
      (p.sku && p.sku.toLowerCase().includes(s)) ||
      (p.brand && p.brand.toLowerCase().includes(s))
    );
  }
  if (query.category) {
    const c = query.category.toLowerCase();
    products = products.filter(p => p.category && p.category.toLowerCase().includes(c));
  }
  return products.slice(0, 15);
}

async function queryProductsInline(proyecto, query) {
  const econfig = proyecto.ecommerce_config;
  if (!econfig?.enabled || !econfig?.platform) return { products: [], categories: [] };
  if (econfig.platform === 'googlesheets') {
    if (query.action === 'categories') {
      const sheetId = extractSheetId(econfig.sheet_url || '');
      if (!sheetId) return { categories: [] };
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      const res = await fetch(csvUrl);
      if (!res.ok) return { categories: [] };
      const text = await res.text();
      const rows = parseCSV(text);
      const cats = new Set();
      rows.forEach(r => { const cat = r.categoria || r.category || ''; if (cat) cats.add(cat); });
      return { categories: Array.from(cats).map(name => ({ name })) };
    }
    return { products: await queryGoogleSheetsInline(econfig, query) };
  }
  return { products: [], categories: [] };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { proyecto_id, message, visitor_id, channel } = await req.json();
    
    if (!proyecto_id || !message) {
      return Response.json({ error: 'proyecto_id and message are required' }, { status: 400 });
    }

    const proyecto = await base44.asServiceRole.entities.Proyecto.get(proyecto_id);
    if (!proyecto?.chatbot_config) {
      return Response.json({ error: 'Chatbot not configured' }, { status: 400 });
    }

    // Check message limit
    const currentCount = proyecto.mensajes_count || 0;
    let globalLimit = 200;
    try {
      const configs = await base44.asServiceRole.entities.ConfigGlobal.filter({ clave: "global" });
      if (configs.length > 0 && configs[0].limite_mensajes_mes) {
        globalLimit = configs[0].limite_mensajes_mes;
      }
    } catch (e) {
      console.log('Config fetch error (using default):', e.message);
    }

    if (currentCount >= globalLimit) {
      return Response.json({ reply: 'Has alcanzado tu límite mensual de conversaciones.' });
    }

    // Increment message counter
    await base44.asServiceRole.entities.Proyecto.update(proyecto_id, {
      mensajes_count: currentCount + 1
    });

    const config = proyecto.chatbot_config;
    const ecommerce = proyecto.ecommerce_config;
    const hasEcommerce = ecommerce?.enabled && ecommerce?.platform;
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 });

    // ── Resolve visitor_id ──
    const vid = visitor_id || ('anon_' + Date.now().toString(36));

    // ── Save user message to ConversacionChat ──
    try {
      await base44.asServiceRole.entities.ConversacionChat.create({
        proyecto_id,
        visitor_id: vid,
        canal: channel || 'web',
        role: 'user',
        content: message,
      });
    } catch (e) {
      console.log('Error saving user msg to ConversacionChat:', e.message);
    }

    // ── Load history from ConversacionChat (DB-backed) ──
    let history = [];
    try {
      const historial = await base44.asServiceRole.entities.ConversacionChat.filter(
        { proyecto_id, visitor_id: vid },
        'created_date', 30
      );
      // Exclude the message we just saved (last one)
      for (let i = 0; i < historial.length; i++) {
        const m = historial[i];
        if (i === historial.length - 1 && m.role === 'user' && m.content === message) continue;
        history.push({ role: m.role, content: m.content });
      }
      if (history.length > 20) history = history.slice(-20);
    } catch (e) {
      console.log('Error loading ConversacionChat:', e.message);
    }

    // ── Load existing lead data ──
    let leadDataKnown = { nombre: null, email: null, telefono: null, empresa: null };
    try {
      const existingLeads = await base44.asServiceRole.entities.Lead.filter({ proyecto_id, visitor_id: vid });
      if (existingLeads.length > 0) {
        const ld = existingLeads[0];
        if (ld.nombre) leadDataKnown.nombre = ld.nombre;
        if (ld.email) leadDataKnown.email = ld.email;
        if (ld.telefono) leadDataKnown.telefono = ld.telefono;
        if (ld.empresa) leadDataKnown.empresa = ld.empresa;
      }
    } catch (e) {
      console.log('Error loading lead:', e.message);
    }

    // ── Build lead context ──
    let leadContext = '\n\nDATOS YA CONOCIDOS DEL CLIENTE:';
    if (leadDataKnown.nombre) leadContext += '\n- Nombre: ' + leadDataKnown.nombre;
    if (leadDataKnown.email) leadContext += '\n- Email: ' + leadDataKnown.email;
    if (leadDataKnown.telefono) leadContext += '\n- Teléfono: ' + leadDataKnown.telefono;
    if (leadDataKnown.empresa) leadContext += '\n- Empresa: ' + leadDataKnown.empresa;
    if (!leadDataKnown.nombre) leadContext += '\n- Nombre: NO CONOCIDO (pregúntalo UNA vez si no lo has hecho en el historial)';
    if (!leadDataKnown.email && !leadDataKnown.telefono) leadContext += '\n- Contacto: NO CONOCIDO';
    leadContext += '\nIMPORTANTE: NO pidas datos que ya aparecen arriba. Si ya tienes nombre y contacto, NO pidas nada más.';

    // ── Product detection ──
    let productContext = '';
    if (hasEcommerce) {
      try {
        const detectRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: `Analiza este mensaje y determina si pregunta sobre productos, precios, stock o categorías.\n\nMensaje: "${message}"\n\nResponde SOLO con JSON válido (sin markdown):\n{"is_product_query": true/false, "action": "products" o "categories", "search": "término" o null, "category": "categoría" o null}`
            }],
            max_tokens: 100,
            temperature: 0
          })
        });
        const detectData = await detectRes.json();
        const rawDetect = detectData.choices?.[0]?.message?.content || '';
        const parsed = JSON.parse(rawDetect.replace(/```json?\s*/g, '').replace(/```/g, '').trim());
        if (parsed.is_product_query) {
          const qData = await queryProductsInline(proyecto, {
            action: parsed.action || 'products',
            search: parsed.search || '',
            category: parsed.category || '',
          });
          if (parsed.action === 'categories' && qData.categories?.length) {
            productContext = `\n\nCATEGORÍAS DISPONIBLES:\n${qData.categories.map(c => '• ' + c.name).join('\n')}`;
          } else if (qData.products?.length) {
            productContext = `\n\nPRODUCTOS ENCONTRADOS:\n${formatProductsForChat(qData.products)}`;
          } else {
            productContext = '\n\nBÚSQUEDA: No se encontraron resultados. Muestra alternativas de contacto.';
          }
        }
      } catch (e) {
        console.log('Product detection error:', e.message);
      }
    }

    // ── Build system prompt ──
    let ecommerceInstructions = '';
    if (hasEcommerce) {
      ecommerceInstructions = `\n- TIENDA ONLINE (${ecommerce.platform}). Muestra nombre, precio y disponibilidad.`;
      if (ecommerce.platform === 'googlesheets') {
        ecommerceInstructions += '\n- Inventario desde Google Sheet. Incluye enlaces si hay.';
      }
    }

    const systemPrompt = `Eres el asistente virtual de "${config.nombre_negocio}".
Responde de forma amable, clara y concisa.

REGLAS:
- Responde SOLO con información de la base de conocimiento o productos proporcionados.
- Si no tienes la info, sugiere contactar directamente.
- Sé breve (máx 4-5 frases, más si son listas de productos).
- Tono profesional pero cercano.
- Contacto: ${config.telefono ? 'Tel: ' + config.telefono : ''}${config.email ? ' Email: ' + config.email : ''}${config.direccion ? ' Dir: ' + config.direccion : ''}
- Web: ${proyecto.url_origen || ''}
- Responde en el idioma del usuario.${ecommerceInstructions}${leadContext}

BASE DE CONOCIMIENTO:
${config.knowledge_base || config.descripcion || 'Sin información disponible.'}${productContext}`;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        max_tokens: 500,
        temperature: 0.5
      })
    });

    const aiData = await response.json();
    const reply = aiData.choices?.[0]?.message?.content || 'Lo siento, no he podido procesar tu consulta.';

    // ── Save assistant reply to ConversacionChat ──
    try {
      await base44.asServiceRole.entities.ConversacionChat.create({
        proyecto_id,
        visitor_id: vid,
        canal: channel || 'web',
        role: 'assistant',
        content: reply,
      });
    } catch (e) {
      console.log('Error saving assistant msg:', e.message);
    }

    // ── Lead capture ──
    try {
      const allUserMsgs = [...history.filter(m => m.role === 'user').map(m => m.content), message];
      const userMsgsText = allUserMsgs.join('\n');
      
      const leadDetectRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Extrae datos de contacto del siguiente texto. Solo datos explícitos. No inventes.\n\nMensajes:\n${userMsgsText}\n\nJSON válido (sin markdown):\n{"nombre": null, "email": null, "telefono": null, "empresa": null, "intereses": null, "has_data": false}`
          }],
          max_tokens: 150,
          temperature: 0
        })
      });
      const leadData = await leadDetectRes.json();
      const rawLead = leadData.choices?.[0]?.message?.content || '';
      const parsedLead = JSON.parse(rawLead.replace(/```json?\s*/g, '').replace(/```/g, '').trim());
      
      const existingLeads = await base44.asServiceRole.entities.Lead.filter({ proyecto_id, visitor_id: vid });
      
      const leadPayload = {
        proyecto_id,
        visitor_id: vid,
        canal: channel || 'web',
        mensajes_count: allUserMsgs.length,
        ultimo_mensaje: new Date().toISOString(),
      };
      if (parsedLead.nombre) leadPayload.nombre = parsedLead.nombre;
      if (parsedLead.email) leadPayload.email = parsedLead.email;
      if (parsedLead.telefono) leadPayload.telefono = parsedLead.telefono;
      if (parsedLead.empresa) leadPayload.empresa = parsedLead.empresa;
      if (parsedLead.intereses) leadPayload.notas = parsedLead.intereses;

      if (existingLeads.length > 0) {
        const existing = existingLeads[0];
        const updateData = { ...leadPayload };
        if (!updateData.nombre && existing.nombre) delete updateData.nombre;
        if (!updateData.email && existing.email) delete updateData.email;
        if (!updateData.telefono && existing.telefono) delete updateData.telefono;
        if (!updateData.empresa && existing.empresa) delete updateData.empresa;
        if (!updateData.notas && existing.notas) delete updateData.notas;
        await base44.asServiceRole.entities.Lead.update(existing.id, updateData);

        const hadContact = existing.email || existing.telefono;
        const hasNewContact = (parsedLead.email && !existing.email) || (parsedLead.telefono && !existing.telefono);
        if (!hadContact && hasNewContact && config.notification_email) {
          base44.asServiceRole.functions.invoke('notifyNewLead', {
            notification_email: config.notification_email,
            nombre_negocio: config.nombre_negocio,
            lead: { ...parsedLead, canal: channel || 'web' },
            proyecto_id,
          }).catch(e => console.log('Notification error:', e.message));
        }
      } else {
        await base44.asServiceRole.entities.Lead.create(leadPayload);

        if (parsedLead.has_data && config.notification_email) {
          base44.asServiceRole.functions.invoke('notifyNewLead', {
            notification_email: config.notification_email,
            nombre_negocio: config.nombre_negocio,
            lead: { ...parsedLead, canal: channel || 'web' },
            proyecto_id,
          }).catch(e => console.log('Notification error:', e.message));
        }
      }
    } catch (e) {
      console.log('Lead capture error (non-blocking):', e.message);
    }

    return Response.json({ reply });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});