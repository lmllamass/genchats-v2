import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import OpenAI from 'npm:openai';

// ─── Inline Google Sheets query (avoids inter-function auth issues) ───
function parseCSV(text) {
  const lines = text.split('\n').filter(function(l) { return l.trim(); });
  if (lines.length < 2) return [];
  var parseRow = function(line) {
    var result = []; var current = ''; var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += ch;
    }
    result.push(current.trim());
    return result;
  };
  var headers = parseRow(lines[0]).map(function(h) { return h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); });
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var values = parseRow(lines[i]);
    var row = {};
    headers.forEach(function(h, idx) { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function extractSheetId(url) {
  var match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function queryGoogleSheetsInline(econfig, query) {
  var sheetId = extractSheetId(econfig.sheet_url || '');
  if (!sheetId) return [];
  var csvUrl = 'https://docs.google.com/spreadsheets/d/' + sheetId + '/export?format=csv';
  var res = await fetch(csvUrl);
  if (!res.ok) return [];
  var text = await res.text();
  var rows = parseCSV(text);
  var products = rows.map(function(r) {
    return {
      name: r.nombre || r.name || r.producto || '',
      price: r.precio || r.price || null,
      stock: r.stock || r.cantidad || r.inventory || null,
      category: r.categoria || r.category || null,
      url: r.url || r.enlace || r.link || null,
      description: r.descripcion || r.description || null,
      sku: r.sku || r.referencia || r.ref || null,
      brand: r.marca || r.brand || null,
    };
  }).filter(function(p) { return p.name; });
  if (query.search) {
    var s = query.search.toLowerCase();
    products = products.filter(function(p) {
      return p.name.toLowerCase().includes(s) ||
        (p.description && p.description.toLowerCase().includes(s)) ||
        (p.sku && p.sku.toLowerCase().includes(s)) ||
        (p.brand && p.brand.toLowerCase().includes(s));
    });
  }
  if (query.category) {
    var c = query.category.toLowerCase();
    products = products.filter(function(p) { return p.category && p.category.toLowerCase().includes(c); });
  }
  return products.slice(0, 15);
}

async function queryProductsInline(proyecto, query) {
  var econfig = proyecto.ecommerce_config;
  if (!econfig || !econfig.enabled || !econfig.platform) return { products: [], categories: [] };
  if (econfig.platform === 'googlesheets') {
    if (query.action === 'categories') {
      var sheetId = extractSheetId(econfig.sheet_url || '');
      if (!sheetId) return { categories: [] };
      var csvUrl = 'https://docs.google.com/spreadsheets/d/' + sheetId + '/export?format=csv';
      var res = await fetch(csvUrl);
      if (!res.ok) return { categories: [] };
      var text = await res.text();
      var rows = parseCSV(text);
      var cats = {};
      rows.forEach(function(r) { var cat = r.categoria || r.category || ''; if (cat) cats[cat] = true; });
      return { categories: Object.keys(cats).map(function(name) { return { name: name }; }) };
    }
    return { products: await queryGoogleSheetsInline(econfig, query) };
  }
  return { products: [], categories: [] };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req, { forceServiceRole: true });
    const body = await req.json();

    let YCLOUD_API_KEY = Deno.env.get("YCLOUD_API_KEY");
    let OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    let openaiModelo = "gpt-4o-mini";

    if (!YCLOUD_API_KEY || !OPENAI_API_KEY) {
      try {
        const configs = await base44.asServiceRole.entities.ConfigPlataforma.filter({ clave: "plataforma" });
        if (configs.length) {
          if (!YCLOUD_API_KEY) YCLOUD_API_KEY = configs[0].ycloud_api_key;
          if (!OPENAI_API_KEY) OPENAI_API_KEY = configs[0].openai_api_key;
          if (configs[0].openai_modelo) openaiModelo = configs[0].openai_modelo;
        }
      } catch (err) {
        console.log("ConfigPlataforma error: " + String(err));
      }
    }

    console.log("YCloud webhook received: " + body.type);

    // ── Status updates ──
    if (body.type === "whatsapp.message.updated") {
      const msg = body.whatsappMessage;
      if (msg && msg.id && msg.status) {
        try {
          const mensajes = await base44.asServiceRole.entities.MensajeWA.filter({ wamid: msg.id });
          if (mensajes.length > 0) {
            const statusMap = { sent: "enviado", delivered: "entregado", read: "leido", failed: "error" };
            const newEstado = statusMap[msg.status] || msg.status;
            await base44.asServiceRole.entities.MensajeWA.update(mensajes[0].id, { estado: newEstado });
          }
        } catch (err) {
          console.log("Status update error: " + String(err));
        }
      }
      return Response.json({ ok: true });
    }

    if (body.type !== "whatsapp.inbound_message.received") {
      return Response.json({ ok: true });
    }

    const inbound = body.whatsappInboundMessage;
    if (!inbound || inbound.type !== "text" || !inbound.text || !inbound.text.body) {
      return Response.json({ ok: true });
    }

    const fromNumber = inbound.from;
    const toNumber = inbound.to;
    const textoCliente = inbound.text.body;
    const wamid = inbound.id;

    console.log("Message from " + fromNumber + " to " + toNumber + ": " + textoCliente);

    // ── Deduplication: check if we already processed this wamid ──
    try {
      const existing = await base44.asServiceRole.entities.MensajeWA.filter({ wamid: wamid });
      if (existing.length > 0) {
        console.log("Duplicate wamid " + wamid + " — skipping");
        return Response.json({ ok: true });
      }
    } catch (err) {
      console.log("Dedup check error: " + String(err));
    }

    // ── Find project ──
    const proyectos = await base44.asServiceRole.entities.Proyecto.filter({ ycloud_phone_number: toNumber });
    if (!proyectos.length) {
      console.log("No project found for phone " + toNumber);
      return Response.json({ ok: true });
    }

    const proyecto = proyectos[0];
    console.log("Found project: " + proyecto.nombre + " (" + proyecto.id + ")");

    if (proyecto.estado !== "pro_activo" && proyecto.estado !== "activo") {
      console.log("Project not active: " + proyecto.estado);
      return Response.json({ ok: true });
    }

    const projectApiKey = proyecto.ycloud_api_key || YCLOUD_API_KEY;
    if (!projectApiKey) {
      console.log("No YCloud API key available");
      return Response.json({ ok: true });
    }

    // ── Save inbound message to MensajeWA ──
    let mensajeRecord = null;
    try {
      mensajeRecord = await base44.asServiceRole.entities.MensajeWA.create({
        proyecto_id: proyecto.id,
        from_number: fromNumber,
        to_number: toNumber,
        mensaje: textoCliente,
        wamid: wamid,
        estado: "recibido"
      });
    } catch (err) {
      console.log("Error saving message: " + String(err));
    }

    // ── Save to ConversacionChat ──
    const visitorId = fromNumber;
    try {
      await base44.asServiceRole.entities.ConversacionChat.create({
        proyecto_id: proyecto.id,
        visitor_id: visitorId,
        canal: 'whatsapp',
        role: 'user',
        content: textoCliente,
      });
    } catch (err) {
      console.log("Error saving to ConversacionChat: " + String(err));
    }

    if (proyecto.modo_atencion === "humano") {
      console.log("Modo humano, no auto-reply");
      return Response.json({ ok: true });
    }

    const mensajesMes = proyecto.mensajes_mes || 0;
    const limiteMensajes = proyecto.limite_mensajes || 200;

    if (mensajesMes >= limiteMensajes) {
      await sendYCloudMessage(fromNumber, "Lo sentimos, hemos alcanzado el limite de mensajes este mes.", projectApiKey, toNumber);
      return Response.json({ ok: true });
    }

    // ── Load history from ConversacionChat (reliable DB-backed) ──
    let messages = [];
    try {
      const historial = await base44.asServiceRole.entities.ConversacionChat.filter(
        { proyecto_id: proyecto.id, visitor_id: visitorId },
        'created_date', 30
      );
      // Exclude the current user message (already added above) — it's the last one
      for (let i = 0; i < historial.length; i++) {
        const m = historial[i];
        if (m.role === 'user' && m.content === textoCliente && i === historial.length - 1) continue;
        messages.push({ role: m.role, content: m.content });
      }
      // Keep last 20 messages
      if (messages.length > 20) messages = messages.slice(-20);
    } catch (err) {
      console.log("Error loading ConversacionChat history: " + String(err));
      // Fallback to MensajeWA
      try {
        const historial = await base44.asServiceRole.entities.MensajeWA.filter({ proyecto_id: proyecto.id, from_number: fromNumber }, 'created_date', 20);
        for (let i = 0; i < historial.length; i++) {
          const m = historial[i];
          if (mensajeRecord && m.id === mensajeRecord.id) continue;
          if (m.mensaje && m.respuesta) {
            messages.push({ role: "user", content: m.mensaje });
            messages.push({ role: "assistant", content: m.respuesta });
          }
        }
        if (messages.length > 20) messages = messages.slice(-20);
      } catch (err2) {
        console.log("Error loading MensajeWA history: " + String(err2));
      }
    }

    // ── Load existing lead data to inject into prompt ──
    let leadDataKnown = { nombre: null, email: null, telefono: fromNumber, empresa: null };
    try {
      const existingLeads = await base44.asServiceRole.entities.Lead.filter({ proyecto_id: proyecto.id, visitor_id: visitorId });
      if (existingLeads.length > 0) {
        const ld = existingLeads[0];
        if (ld.nombre) leadDataKnown.nombre = ld.nombre;
        if (ld.email) leadDataKnown.email = ld.email;
        if (ld.empresa) leadDataKnown.empresa = ld.empresa;
      }
    } catch (err) {
      console.log("Error loading lead: " + String(err));
    }

    // ── Build lead context for the prompt ──
    let leadContext = '\n\nDATOS YA CONOCIDOS DEL CLIENTE:';
    if (leadDataKnown.nombre) leadContext += '\n- Nombre: ' + leadDataKnown.nombre;
    if (leadDataKnown.email) leadContext += '\n- Email: ' + leadDataKnown.email;
    if (leadDataKnown.telefono) leadContext += '\n- Teléfono: ' + leadDataKnown.telefono;
    if (leadDataKnown.empresa) leadContext += '\n- Empresa: ' + leadDataKnown.empresa;
    if (!leadDataKnown.nombre) leadContext += '\n- Nombre: NO CONOCIDO (puedes preguntarlo UNA vez si aún no lo has hecho en el historial)';
    if (!leadDataKnown.email && !leadDataKnown.telefono) leadContext += '\n- Contacto: NO CONOCIDO';
    leadContext += '\nIMPORTANTE: NO pidas datos que ya aparecen arriba. Si ya tienes nombre y contacto, NO pidas nada más.';

    // ── Product search (ecommerce) ──
    const config = proyecto.chatbot_config || {};
    const ecommerce = proyecto.ecommerce_config;
    const hasEcommerce = ecommerce && ecommerce.enabled && ecommerce.platform;

    let productContext = '';
    if (hasEcommerce && OPENAI_API_KEY) {
      try {
        const detectRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + OPENAI_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: 'Analiza este mensaje de un cliente de una tienda online y determina si está preguntando sobre productos, precios, stock, disponibilidad o categorías.\n\nMensaje: "' + textoCliente + '"\n\nResponde SOLO con un JSON válido (sin markdown):\n{"is_product_query": true/false, "action": "products" o "categories", "search": "término de búsqueda" o null, "category": "nombre de categoría" o null}'
            }],
            max_tokens: 100,
            temperature: 0
          })
        });
        const detectData = await detectRes.json();
        const rawDetect = (detectData.choices && detectData.choices[0] && detectData.choices[0].message && detectData.choices[0].message.content) || '';
        const parsed = JSON.parse(rawDetect.replace(/```json?\s*/g, '').replace(/```/g, '').trim());

        if (parsed.is_product_query) {
          console.log("Product query detected: " + JSON.stringify(parsed));
          const qData = await queryProductsInline(proyecto, {
            action: parsed.action || 'products',
            search: parsed.search || '',
            category: parsed.category || '',
          });
          if (parsed.action === 'categories' && qData.categories && qData.categories.length) {
            productContext = '\n\nCATEGORÍAS DISPONIBLES EN LA TIENDA:\n' + qData.categories.map(function(c) { return '• ' + c.name; }).join('\n');
          } else if (qData.products && qData.products.length) {
            productContext = '\n\nPRODUCTOS ENCONTRADOS EN LA TIENDA:\n' + qData.products.map(function(p) {
              let t = '• ' + p.name;
              if (p.brand) t += ' (' + p.brand + ')';
              if (p.price) t += ' — ' + p.price + '€';
              if (p.stock !== undefined && p.stock !== null) t += ' | Stock: ' + (p.stock > 0 ? p.stock : 'Agotado');
              if (p.sku) t += ' | SKU: ' + p.sku;
              if (p.category) t += ' | Cat: ' + p.category;
              if (p.url) t += ' | ' + p.url;
              return t;
            }).join('\n');
          } else {
            productContext = '\n\nBÚSQUEDA DE PRODUCTOS: No se encontraron resultados. Muestra alternativas de contacto.';
          }
        }
      } catch (err) {
        console.log("Product search error (non-blocking): " + String(err));
      }
    }

    // ── Ecommerce instructions ──
    let ecommerceInstructions = '';
    if (hasEcommerce) {
      ecommerceInstructions = '\n- Esta es una TIENDA ONLINE (' + ecommerce.platform + '). Puedes consultar productos, precios, stock y categorías.';
      if (ecommerce.platform === 'googlesheets') {
        ecommerceInstructions += '\n- El inventario se carga desde Google Sheet. Si un producto tiene "url", incluye el enlace.';
      }
    }

    // ── Build system prompt ──
    const nombreNegocio = config.nombre_negocio || proyecto.nombre;
    const contactoTel = config.telefono || '';
    const contactoEmail = config.email || '';
    const contactoDir = config.direccion || '';
    const urlOrigen = proyecto.url_origen || '';
    const knowledgeBase = config.knowledge_base || config.descripcion || '';

    const finalSystemPrompt = 'Eres el asistente virtual de "' + nombreNegocio + '" en WhatsApp.\nTu objetivo es responder preguntas de los clientes de forma amable, clara y concisa.\n\nREGLAS:\n- Responde SOLO con información de la base de conocimiento o productos proporcionados.\n- Si no tienes la información, sugiere contactar directamente.\n- Sé breve (máx 4-5 frases, más si son listas de productos).\n- Tono profesional pero cercano.\n- Contacto: ' + (contactoTel ? 'Tel: ' + contactoTel + ' ' : '') + (contactoEmail ? 'Email: ' + contactoEmail + ' ' : '') + (contactoDir ? 'Dir: ' + contactoDir : '') + '\n- Web: ' + urlOrigen + '\n- Responde en el idioma del usuario.' + ecommerceInstructions + leadContext + '\n\nBASE DE CONOCIMIENTO:\n' + (knowledgeBase || 'Sin información disponible.') + productContext;

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: openaiModelo,
      messages: [
        { role: "system", content: finalSystemPrompt },
        ...messages,
        { role: "user", content: textoCliente }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const respuestaIA = (completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content) || "Lo siento, no pude procesar tu consulta.";
    console.log("AI reply: " + respuestaIA.substring(0, 100));

    // ── Save assistant response to ConversacionChat ──
    try {
      await base44.asServiceRole.entities.ConversacionChat.create({
        proyecto_id: proyecto.id,
        visitor_id: visitorId,
        canal: 'whatsapp',
        role: 'assistant',
        content: respuestaIA,
      });
    } catch (err) {
      console.log("Error saving assistant to ConversacionChat: " + String(err));
    }

    const sendResult = await sendYCloudMessage(fromNumber, respuestaIA, projectApiKey, toNumber);

    if (mensajeRecord) {
      try {
        await base44.asServiceRole.entities.MensajeWA.update(mensajeRecord.id, {
          respuesta: respuestaIA,
          estado: sendResult.ok ? "enviado" : "error"
        });
      } catch (err) {
        console.log("Error updating message: " + String(err));
      }
    }

    try {
      await base44.asServiceRole.entities.Proyecto.update(proyecto.id, { mensajes_mes: mensajesMes + 1 });
    } catch (err) {
      console.log("Error updating counter: " + String(err));
    }

    // ── Lead capture ──
    try {
      const allUserMsgs = messages.filter(function(m) { return m.role === 'user'; }).map(function(m) { return m.content; });
      allUserMsgs.push(textoCliente);
      const userMsgsText = allUserMsgs.join('\n');

      const leadDetectRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: 'Extrae datos de contacto del siguiente texto de un cliente en un chat de WhatsApp. Solo extrae datos que el usuario haya proporcionado explícitamente (nombre, email, teléfono, empresa). No inventes datos.\n\nMensajes del usuario:\n' + userMsgsText + '\n\nResponde SOLO con JSON válido (sin markdown):\n{"nombre": null, "email": null, "telefono": null, "empresa": null, "intereses": null, "has_data": false}\nSi encontraste al menos un dato real, pon has_data=true.'
          }],
          max_tokens: 150,
          temperature: 0
        })
      });
      const leadData = await leadDetectRes.json();
      const rawLead = (leadData.choices && leadData.choices[0] && leadData.choices[0].message && leadData.choices[0].message.content) || '';
      const parsedLead = JSON.parse(rawLead.replace(/```json?\s*/g, '').replace(/```/g, '').trim());

      const existingLeads = await base44.asServiceRole.entities.Lead.filter({ proyecto_id: proyecto.id, visitor_id: visitorId });

      const leadPayload = {
        proyecto_id: proyecto.id,
        visitor_id: visitorId,
        canal: 'whatsapp',
        mensajes_count: allUserMsgs.length,
        ultimo_mensaje: new Date().toISOString(),
        telefono: fromNumber,
      };
      if (parsedLead.nombre) leadPayload.nombre = parsedLead.nombre;
      if (parsedLead.email) leadPayload.email = parsedLead.email;
      if (parsedLead.empresa) leadPayload.empresa = parsedLead.empresa;
      if (parsedLead.intereses) leadPayload.notas = parsedLead.intereses;

      if (existingLeads.length > 0) {
        const existing = existingLeads[0];
        const updateData = { ...leadPayload };
        if (!updateData.nombre && existing.nombre) delete updateData.nombre;
        if (!updateData.email && existing.email) delete updateData.email;
        if (!updateData.empresa && existing.empresa) delete updateData.empresa;
        if (!updateData.notas && existing.notas) delete updateData.notas;
        await base44.asServiceRole.entities.Lead.update(existing.id, updateData);
        console.log("Lead updated: " + existing.id);

        const hadEmail = existing.email;
        const hasNewEmail = parsedLead.email && !existing.email;
        if (!hadEmail && hasNewEmail && config.notification_email) {
          base44.asServiceRole.functions.invoke('notifyNewLead', {
            notification_email: config.notification_email,
            nombre_negocio: nombreNegocio,
            lead: { ...parsedLead, telefono: fromNumber, canal: 'whatsapp' },
            proyecto_id: proyecto.id,
          }).catch(function(e) { console.log('Notification error: ' + String(e)); });
        }
      } else {
        await base44.asServiceRole.entities.Lead.create(leadPayload);
        console.log("Lead created for " + fromNumber);

        if (parsedLead.has_data && config.notification_email) {
          base44.asServiceRole.functions.invoke('notifyNewLead', {
            notification_email: config.notification_email,
            nombre_negocio: nombreNegocio,
            lead: { ...parsedLead, telefono: fromNumber, canal: 'whatsapp' },
            proyecto_id: proyecto.id,
          }).catch(function(e) { console.log('Notification error: ' + String(e)); });
        }
      }
    } catch (err) {
      console.log("Lead capture error (non-blocking): " + String(err));
    }

    return Response.json({ ok: true });

  } catch (error) {
    console.error("ycloudWebhook error: " + String(error));
    return Response.json({ ok: true });
  }
});

async function sendYCloudMessage(to, text, apiKey, fromNumber) {
  try {
    const payload = { from: fromNumber, to: to, type: "text", text: { body: text } };
    console.log("YCloud payload: " + JSON.stringify(payload));
    const res = await fetch("https://api.ycloud.com/v2/whatsapp/messages", {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("YCloud send: " + res.status + " " + JSON.stringify(data).substring(0, 300));
    return { ok: res.ok, data: data };
  } catch (err) {
    console.error("YCloud send error: " + String(err));
    return { ok: false, error: String(err) };
  }
}