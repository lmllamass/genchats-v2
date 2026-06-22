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
      frontend_url: process.env.APP_URL || 'https://v2.genchats.app',
      api_url:      process.env.API_PUBLIC_URL || 'https://api-v2.genchats.app',
    },
  });
});

export default router;
