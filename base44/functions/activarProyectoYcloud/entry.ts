import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const YCLOUD_API_KEY = Deno.env.get("YCLOUD_API_KEY");
const GENCHAT_WEBHOOK_URL = Deno.env.get("GENCHAT_WEBHOOK_URL");

async function ycloudFetch(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "X-API-Key": YCLOUD_API_KEY,
      "Content-Type": "application/json"
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.ycloud.com/v2${path}`, opts);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function buildSystemPrompt(proyecto) {
  const c = proyecto.chatbot_config || {};
  const ecom = proyecto.ecommerce_config || {};
  const nombre = c.nombre_negocio || proyecto.nombre || "Negocio";

  let prompt = `Eres el asistente virtual de ${nombre}. Atiendes por WhatsApp de forma profesional y cercana en español. No menciones que eres ChatGPT ni OpenAI.

## Información del negocio
- Nombre: ${nombre}
- Web: ${proyecto.url_origen || "N/A"}
- Dirección: ${c.direccion || "N/A"}
- Teléfono: ${c.telefono || "N/A"}
- Email: ${c.email || "N/A"}

## Descripción
${c.descripcion || "Sin descripción disponible."}

## Base de conocimiento
${c.knowledge_base || "Sin información adicional."}`;

  if (ecom.enabled) {
    prompt += `

## Tienda online (${ecom.platform || "N/A"})
- URL: ${ecom.store_url || "N/A"}`;
  }

  prompt += `

## Modo de atención: COEXISTENCIA
Un agente humano puede tomar el control en cualquier momento. Si el cliente pregunta si habla con un bot: "Soy un asistente virtual. Si prefieres hablar con una persona, dímelo."

## Reglas
- Mensajes cortos, máximo 3-4 líneas. WhatsApp no es email.
- Si no sabes algo: "Déjame consultarlo con el equipo."
- Si pide hablar con persona: "Ahora te paso con el equipo." y no respondas más.
- Nunca inventes precios ni datos que no estén en la base de conocimiento.

## Bienvenida
${c.welcome_message || `¡Hola! 👋 Soy el asistente virtual de ${nombre}. ¿En qué puedo ayudarte?`}`;

  return prompt;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    const { proyecto_id, waba_id, phone_number_id } = await req.json();
    if (!proyecto_id || !waba_id || !phone_number_id) {
      return Response.json({ ok: false, error: "Faltan parámetros: proyecto_id, waba_id, phone_number_id" });
    }

    // Read project
    const proyecto = await base44.asServiceRole.entities.Proyecto.get(proyecto_id);
    if (!proyecto) {
      return Response.json({ ok: false, error: "Proyecto no encontrado" });
    }

    console.log(`Activating WhatsApp for project ${proyecto.nombre} (${proyecto_id})`);

    // 1. Bind WABA
    const bindRes = await ycloudFetch(`/whatsapp/businessAccounts/${waba_id}/tp/bind`, "POST");
    if (!bindRes.ok) {
      console.error("WABA bind failed:", JSON.stringify(bindRes.data));
      return Response.json({ ok: false, error: "Error al vincular WABA: " + (bindRes.data?.message || bindRes.status) });
    }
    console.log("WABA bound successfully");

    // 2. Register phone number
    const regRes = await ycloudFetch(`/whatsapp/phoneNumbers/${waba_id}/${phone_number_id}/register`, "POST");
    if (!regRes.ok) {
      console.error("Phone register failed:", JSON.stringify(regRes.data));
      return Response.json({ ok: false, error: "Error al registrar número: " + (regRes.data?.message || regRes.status) });
    }
    console.log("Phone number registered");

    // 3. Get real phone number
    const phoneRes = await ycloudFetch(`/whatsapp/phoneNumbers/${phone_number_id}`);
    if (!phoneRes.ok) {
      return Response.json({ ok: false, error: "Error al obtener número: " + (phoneRes.data?.message || phoneRes.status) });
    }
    const phoneNumber = phoneRes.data.phoneNumber;
    console.log(`Phone number: ${phoneNumber}`);

    // 4. Ensure webhook exists
    const webhooksRes = await ycloudFetch("/webhookEndpoints");
    const existingWebhooks = webhooksRes.ok ? (webhooksRes.data?.items || webhooksRes.data || []) : [];
    const webhookExists = Array.isArray(existingWebhooks) && existingWebhooks.some(
      w => w.url === GENCHAT_WEBHOOK_URL
    );

    if (!webhookExists && GENCHAT_WEBHOOK_URL) {
      const whRes = await ycloudFetch("/webhookEndpoints", "POST", {
        url: GENCHAT_WEBHOOK_URL,
        enabledEvents: ["whatsapp.inbound_message.received", "whatsapp.message.updated"],
        status: "active"
      });
      console.log("Webhook created:", whRes.ok, JSON.stringify(whRes.data).substring(0, 200));
    } else {
      console.log("Webhook already exists or URL not configured");
    }

    // 5. Generate system prompt
    const systemPrompt = buildSystemPrompt(proyecto);

    // 6. Update project
    await base44.asServiceRole.entities.Proyecto.update(proyecto_id, {
      ycloud_waba_id: waba_id,
      ycloud_phone_number_id: phone_number_id,
      ycloud_phone_number: phoneNumber,
      system_prompt: systemPrompt,
      whatsapp_activo: true,
      modo_atencion: "coexistencia",
      mensajes_mes: 0,
      limite_mensajes: 200
    });

    console.log(`Project ${proyecto_id} WhatsApp activated: ${phoneNumber}`);
    return Response.json({ ok: true, phone_number: phoneNumber });
  } catch (error) {
    console.error("activarProyectoYcloud error:", error.message);
    return Response.json({ ok: false, error: error.message });
  }
});