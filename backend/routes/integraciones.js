/**
 * integraciones.js — contexto de un proyecto para automatizaciones externas.
 *
 * Los workflows que dispara el agente reciben la configuración en el propio
 * webhook (ver actionsService). Pero los que corren solos —un recordatorio
 * diario, una limpieza nocturna— no tienen quien se la dé: no hay conversación
 * detrás. Este endpoint es esa vía, con el mismo secreto compartido.
 *
 * No expone nada que no viaje ya en cada llamada a una acción.
 */
import express from 'express';
import { supabase } from '../server.js';

const router = express.Router();

router.post('/contexto', express.json(), async (req, res) => {
  if (!process.env.DOCS_WEBHOOK_SECRET
    || req.headers['x-docs-secret'] !== process.env.DOCS_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { proyecto_id, tool_name = 'custom' } = req.body || {};
  if (!proyecto_id) return res.status(400).json({ error: 'proyecto_id es obligatorio' });

  try {
    const [{ data: proyecto }, { data: fila }] = await Promise.all([
      supabase.from('proyectos')
        .select('id, nombre, ycloud_api_key, ycloud_phone_number, whatsapp_activo, chatbot_config')
        .eq('id', proyecto_id).single(),
      supabase.from('project_tools').select('config')
        .eq('project_id', proyecto_id).eq('tool_name', tool_name).maybeSingle(),
    ]);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    res.json({
      ok: true,
      proyecto_id: proyecto.id,
      proyecto_nombre: proyecto.chatbot_config?.nombre_negocio || proyecto.nombre,
      tool_config: fila?.config || {},
      ycloud_api_key: proyecto.ycloud_api_key || process.env.YCLOUD_API_KEY || '',
      ycloud_from: proyecto.ycloud_phone_number || '',
      whatsapp_activo: !!proyecto.whatsapp_activo,
    });
  } catch (err) {
    console.error('[integraciones] contexto:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
