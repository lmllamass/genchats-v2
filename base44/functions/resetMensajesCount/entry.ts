import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all projects with active WhatsApp and reset both counters
    const proyectos = await base44.asServiceRole.entities.Proyecto.filter({});
    let resetCount = 0;

    for (const p of proyectos) {
      const needsReset = (p.mensajes_count > 0) || (p.mensajes_mes > 0);
      if (needsReset) {
        await base44.asServiceRole.entities.Proyecto.update(p.id, {
          mensajes_count: 0,
          mensajes_mes: 0
        });
        resetCount++;
      }
    }

    console.log(`Reset message counters for ${resetCount} projects`);
    return Response.json({ ok: true, reset: resetCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});