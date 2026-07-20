// Reset mensual del contador de mensajes (proyectos.mensajes_mes -> 0).
// Pensado para lanzarse por cron el día 1 de cada mes (ver crontab del host/VPS).
// No usa el endpoint HTTP /api/admin/reset-mensajes a propósito: ese requiere un JWT de
// admin (login real), lo que no es práctico desde un cron. Este script habla directo con
// Supabase usando la service role key, igual que hace el propio backend.
//
// Uso manual: node backend/scripts/resetMensajesMensual.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  const { data, error } = await supabase
    .from('proyectos')
    .update({ mensajes_mes: 0 })
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id');

  if (error) {
    console.error(`[reset-mensual] ${new Date().toISOString()} ERROR:`, error.message);
    process.exit(1);
  }

  console.log(`[reset-mensual] ${new Date().toISOString()} OK — ${data.length} proyectos reseteados a mensajes_mes=0`);
}

main();
