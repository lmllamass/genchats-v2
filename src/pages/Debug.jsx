import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/supabaseClient';
import { useState, useEffect } from 'react';

// Diagnostic page — shows real-time auth state so we can diagnose Google OAuth issues.
// Access at /debug (no auth guard — needed precisely when auth is broken).
export default function Debug() {
  const { supabaseUser, isLoadingAuth, isAuthenticated, user, profile } = useAuth();
  const [session, setSession] = useState('checking...');

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      setSession(error ? `ERROR: ${error.message}` : (data.session
        ? { userId: data.session.user?.id, email: data.session.user?.email, expiresAt: data.session.expires_at }
        : null));
    });
  }, []);

  const state = {
    isLoadingAuth,
    isAuthenticated,
    supabaseUser: supabaseUser ? { id: supabaseUser.id, email: supabaseUser.email, providers: supabaseUser.identities?.map(i => i.provider) } : null,
    user: user ? { id: user.id, email: user.email, plan: user.plan, role: user.role, full_name: user.full_name } : null,
    getSession: session,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'https://plsxmckjdxepawajjthc.supabase.co (fallback)',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3', padding: 32, fontFamily: 'monospace' }}>
      <h1 style={{ color: '#8b5cf6', marginBottom: 24 }}>Auth Debug</h1>
      <pre style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {JSON.stringify(state, null, 2)}
      </pre>
      <div style={{ marginTop: 32, fontSize: 12, color: '#7d8590' }}>
        Eliminar esta ruta una vez resuelto el problema.
      </div>
    </div>
  );
}
