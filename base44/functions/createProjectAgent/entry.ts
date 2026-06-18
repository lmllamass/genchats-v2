import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { proyecto_id } = await req.json();
    if (!proyecto_id) {
      return Response.json({ error: 'proyecto_id is required' }, { status: 400 });
    }

    // Get the project
    const proyecto = await base44.asServiceRole.entities.Proyecto.get(proyecto_id);
    if (!proyecto) {
      return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Mark as pending activation
    await base44.asServiceRole.entities.Proyecto.update(proyecto_id, {
      agent_name: 'pending'
    });

    // Notify admin via email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      subject: `🔔 Solicitud de activación de canales - ${proyecto.nombre}`,
      body: `
        <h2>Nueva solicitud de activación de canales</h2>
        <p><strong>Proyecto:</strong> ${proyecto.nombre}</p>
        <p><strong>ID:</strong> ${proyecto_id}</p>
        <p><strong>Usuario:</strong> ${user.full_name} (${user.email})</p>
        <p><strong>URL origen:</strong> ${proyecto.url_origen || 'N/A'}</p>
        <p>Los canales WhatsApp y Telegram están pendientes de activación manual.</p>
      `
    });

    return Response.json({ ok: true, status: 'pending' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});