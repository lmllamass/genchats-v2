import { Router } from 'express';
import { supabase } from '../server.js';

const router = Router();

router.get('/', async (req, res) => {
  // Lightweight DB ping — confirms Supabase is reachable
  let dbOk = false;
  try {
    const { error } = await supabase.from('proyectos').select('id').limit(1);
    dbOk = !error;
  } catch {
    dbOk = false;
  }

  res.json({
    ok: true,
    ts: new Date().toISOString(),
    db: dbOk,
    features: {
      pixel:  true,   // Meta Pixel presente en la app React
      widget: true,   // Chat widget activo (/api/chatbot-public)
      cta:    true,   // CTA buttons presentes en la landing
    },
    checks: {
      frontend_url: 'https://genchats.app',
      api_url:      'https://api.genchats.app',
    },
  });
});

export default router;
