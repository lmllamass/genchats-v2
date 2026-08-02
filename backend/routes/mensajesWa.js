/**
 * mensajesWa.js — historial de mensajes de WhatsApp para el panel.
 *
 * Existe porque `mensajes_wa` se leía DIRECTO desde el navegador con la clave anónima, y su
 * política RLS (`USING (true)` sin `TO service_role`) dejaba que cualquiera —sin login—
 * leyese los mensajes de todos los tenants. Al cerrar esa política (migración 017) el
 * frontend necesita esta ruta, que sí valida el acceso al proyecto.
 */

import express from 'express';
import { supabase } from '../server.js';
import { projectForUser } from '../lib/projectAccess.js';

const router = express.Router();

// GET /api/mensajes-wa?proyecto_id=X&limit=30
router.get('/', async (req, res) => {
  try {
    const { proyecto_id, limit = '30' } = req.query;
    if (!proyecto_id) return res.status(400).json({ error: 'proyecto_id requerido' });

    const proyecto = await projectForUser(proyecto_id, req.user.id);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const { data, error } = await supabase
      .from('mensajes_wa')
      .select('*')
      .eq('proyecto_id', proyecto_id)
      .order('created_at', { ascending: false })
      .limit(Math.min(parseInt(limit) || 30, 200));
    if (error) throw error;

    res.json({ mensajes: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
