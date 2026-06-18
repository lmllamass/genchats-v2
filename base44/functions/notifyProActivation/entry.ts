import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || !event) {
      return Response.json({ ok: false, error: "No event data" });
    }

    const proyecto = data;
    const config = proyecto.chatbot_config || {};
    const nombre = config.nombre_negocio || proyecto.nombre || "Sin nombre";

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: "hola@genchat.es",
      subject: `🚀 Nuevo Pro activado: ${nombre}`,
      body: `
<h2>🎉 Nuevo cliente Pro activado</h2>
<table style="border-collapse:collapse;font-family:sans-serif;">
  <tr><td style="padding:4px 12px;font-weight:bold;">Proyecto:</td><td style="padding:4px 12px;">${nombre}</td></tr>
  <tr><td style="padding:4px 12px;font-weight:bold;">ID:</td><td style="padding:4px 12px;">${proyecto.id}</td></tr>
  <tr><td style="padding:4px 12px;font-weight:bold;">URL:</td><td style="padding:4px 12px;">${proyecto.url_origen || "N/A"}</td></tr>
  <tr><td style="padding:4px 12px;font-weight:bold;">Email cliente:</td><td style="padding:4px 12px;">${config.email || proyecto.created_by || "N/A"}</td></tr>
  <tr><td style="padding:4px 12px;font-weight:bold;">Teléfono:</td><td style="padding:4px 12px;">${config.telefono || "N/A"}</td></tr>
  <tr><td style="padding:4px 12px;font-weight:bold;">WhatsApp activo:</td><td style="padding:4px 12px;">${proyecto.whatsapp_activo ? "✅ Sí" : "❌ No"}</td></tr>
  <tr><td style="padding:4px 12px;font-weight:bold;">Agent name:</td><td style="padding:4px 12px;">${proyecto.agent_name || "Pendiente"}</td></tr>
</table>
<p style="margin-top:16px;color:#666;">Revisa el panel de admin para completar el despliegue si es necesario.</p>
      `
    });

    console.log(`Pro activation email sent for project ${proyecto.id} (${nombre})`);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("notifyProActivation error:", error.message);
    return Response.json({ ok: false, error: error.message });
  }
});