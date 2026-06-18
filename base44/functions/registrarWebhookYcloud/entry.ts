import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { proyecto_id } = await req.json().catch(() => ({}));
    const webhookUrl = "https://genchat.base44.app/functions/ycloudWebhook";

    let apiKey = null;
    let configId = null;

    // If proyecto_id is provided, register webhook for that project's YCloud account
    if (proyecto_id) {
      const proyecto = await base44.asServiceRole.entities.Proyecto.get(proyecto_id);
      if (!proyecto) {
        return Response.json({ ok: false, error: "Proyecto no encontrado" });
      }
      apiKey = proyecto.ycloud_api_key;
      if (!apiKey) {
        return Response.json({ ok: false, error: "Este proyecto no tiene API key de YCloud propia" });
      }
    } else {
      // Fallback: register with master key from ConfigPlataforma
      const configs = await base44.asServiceRole.entities.ConfigPlataforma.filter({ clave: "plataforma" });
      if (!configs.length) {
        return Response.json({ ok: false, error: "ConfigPlataforma no encontrada" });
      }
      const config = configs[0];
      configId = config.id;
      apiKey = config.ycloud_api_key || Deno.env.get("YCLOUD_API_KEY");
    }

    if (!apiKey) {
      return Response.json({ ok: false, error: "No hay API key de YCloud disponible" });
    }

    // List existing webhooks for this YCloud account
    const listRes = await fetch("https://api.ycloud.com/v2/webhookEndpoints", {
      headers: { "X-API-Key": apiKey }
    });
    const listData = await listRes.json();

    if (!listRes.ok) {
      return Response.json({ ok: false, error: "Error listando webhooks: " + JSON.stringify(listData) });
    }

    const items = listData.items || [];

    // Delete old webhooks with wrong URL or old domain
    const oldWebhooks = items.filter(w => w.url && w.url.includes("ycloudWebhook") && w.url !== webhookUrl);
    const deleted = [];
    for (const old of oldWebhooks) {
      const delRes = await fetch("https://api.ycloud.com/v2/webhookEndpoints/" + old.id, {
        method: "DELETE",
        headers: { "X-API-Key": apiKey }
      });
      deleted.push({ id: old.id, url: old.url, status: delRes.status });
      console.log("Deleted old webhook: " + old.id + " (" + old.url + ") status=" + delRes.status);
    }

    // Check if correct webhook already exists
    const existing = items.find(w => w.url === webhookUrl);
    if (existing) {
      if (configId) {
        await base44.asServiceRole.entities.ConfigPlataforma.update(configId, {
          ycloud_webhook_id: existing.id
        });
      }
      return Response.json({ ok: true, status: "ya_existia", id: existing.id, url: webhookUrl, deleted });
    }

    // Create new webhook
    const createRes = await fetch("https://api.ycloud.com/v2/webhookEndpoints", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: webhookUrl,
        enabledEvents: [
          "whatsapp.inbound_message.received",
          "whatsapp.message.updated"
        ],
        status: "active",
        description: "GenChat IA — Webhook"
      })
    });
    const createData = await createRes.json();

    if (!createRes.ok) {
      return Response.json({ ok: false, error: "Error creando webhook: " + JSON.stringify(createData) });
    }

    if (configId) {
      await base44.asServiceRole.entities.ConfigPlataforma.update(configId, {
        ycloud_webhook_id: createData.id
      });
    }

    return Response.json({ ok: true, status: "creado", id: createData.id, url: webhookUrl, deleted });
  } catch (error) {
    console.error("registrarWebhookYcloud error:", error.message);
    return Response.json({ ok: false, error: error.message });
  }
});