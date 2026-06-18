import { createClient } from '@supabase/supabase-js';

// Fallbacks hardcoded: la anon key es pública por diseño (se incluye en el bundle JS igualmente).
// Evita que un rebuild sin las vars de entorno rompa el acceso.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  || 'https://plsxmckjdxepawajjthc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_rDVfEjppEdrUgCXfk50zgQ_3e7x18yN';

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
