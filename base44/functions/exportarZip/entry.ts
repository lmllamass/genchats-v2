import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import JSZip from 'npm:jszip@3.10.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { proyecto_id } = await req.json();
    if (!proyecto_id) return Response.json({ error: 'proyecto_id is required' }, { status: 400 });

    const proyecto = await base44.entities.Proyecto.get(proyecto_id);
    if (!proyecto?.html_generado) return Response.json({ error: 'No HTML to export' }, { status: 400 });

    const readme = `# ${proyecto.nombre}\nGenerado por PageGen AI.\n\n## Publicar\nSube index.html a cualquier hosting estático.\n\nURL origen: ${proyecto.url_origen}\nPlantilla: ${proyecto.plantilla_elegida}\nColor: ${proyecto.esquema_color}\n`;

    const zip = new JSZip();
    zip.file('index.html', proyecto.html_generado);
    zip.file('README.txt', readme);

    const blob = await zip.generateAsync({ type: 'blob' });
    const safeName = (proyecto.nombre || 'pagegen').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pagegen';
    const file = new File([blob], `${safeName}.zip`, { type: 'application/zip' });

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Proyecto.update(proyecto_id, { zip_url: file_url, estado: 'exportado' });

    return Response.json({ zip_url: file_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});