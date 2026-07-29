import { createClient } from '@supabase/supabase-js';

// SIN fallback: un build sin VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY debe fallar de forma
// ruidosa, nunca caer en silencio sobre las credenciales de otro entorno (p. ej. producción).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el build — revisa el .env usado al hacer npm run build.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE is the robust OAuth flow for SPAs: Supabase returns ?code=... which
    // supabase-js exchanges for a session automatically (detectSessionInUrl).
    // This avoids the fragile implicit flow that relies on the URL #hash.
    flowType: 'pkce',
  },
});
