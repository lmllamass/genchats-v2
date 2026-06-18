import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { proyecto_id, to, mensaje } = await req.json();

    if (!proyecto_id || !to || !mensaje) {
      return Response.json({ ok: false, error: "Faltan campos: proyecto_id, to, mensaje" });
    }

    // Get project
    const proyectos = await base44.asServiceRole.entities.Proyecto.filter({ id: proyecto_id });
    if (!proyectos.length) {
      return Response.json({ ok: false, error: "Proyecto no encontrado" });
    }
    const proyecto = proyectos[0];

    // Get API key: project-level first, then env var, then ConfigPlataforma
    let apiKey = proyecto.ycloud_api_key;
    if (!apiKey) apiKey = Deno.env.get("YCLOUD_API_KEY");
    if (!apiKey) {
      const configs = await base44.asServiceRole.entities.ConfigPlataforma.filter({ clave: "plataforma" });
      if (configs.length) apiKey = configs[0].ycloud_api_key;
    }

    if (!apiKey) {
      return Response.json({ ok: false, error: "No hay API key de YCloud configurada (ni en proyecto, ni global)" });
    }

    const wabaId = proyecto.ycloud_waba_id;
    if (!wabaId) {
      return Response.json({ ok: false, error: "El proyecto no tiene WABA ID configurado" });
    }

    const res = await fetch("https://api.ycloud.com/v2/whatsapp/messages", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        wabaId,
        from: proyecto.ycloud_phone_number,
        to,
        type: "text",
        text: { body: mensaje }
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return Response.json({ ok: false, error: JSON.stringify(data) });
    }

    return Response.json({ ok: true, wamid: data.id });
  } catch (error) {
    console.error("enviarMensajePrueba error:", error.message);
    return Response.json({ ok: false, error: error.message });
  }
});