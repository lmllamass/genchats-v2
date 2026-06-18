import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { UserProfile } from '@/api/entidades';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [supabaseUser, setSupabaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        if (session?.user) {
          setSupabaseUser(session.user);
          setIsAuthenticated(true);
          loadProfile(session.user.id, session.user);
        }
        setIsLoadingAuth(false);
      })
      .catch(() => {
        // If the OAuth code exchange rejects, never leave the app stuck loading.
        if (mounted) setIsLoadingAuth(false);
      });

    // IMPORTANT: this callback runs while supabase holds its internal auth lock.
    // It must stay synchronous — calling awaited supabase methods (DB queries,
    // upserts) directly inside deadlocks the lock and is exactly why Google
    // OAuth sessions never settled. We set state synchronously and defer any
    // supabase calls (loadProfile) to the next tick with setTimeout(0).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (session?.user) {
        const u = session.user;
        setSupabaseUser(u);
        setIsAuthenticated(true);
        setIsLoadingAuth(false);
        setTimeout(() => { if (mounted) loadProfile(u.id, u); }, 0);
      } else if (event === 'SIGNED_OUT') {
        setSupabaseUser(null);
        setProfile(null);
        setIsAuthenticated(false);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const loadProfile = async (userId, authUser = null) => {
    try {
      let data = await UserProfile.get(userId);
      if (!data) {
        const fullName = authUser?.user_metadata?.full_name
          || authUser?.user_metadata?.name
          || authUser?.email
          || '';
        const { data: created } = await supabase
          .from('user_profiles')
          .upsert({ id: userId, full_name: fullName, plan: 'free' }, { onConflict: 'id' })
          .select()
          .single();
        data = created;
      }
      setProfile(data);
    } catch (_) {}
  };

  // user object compatible with old base44 usage across the app
  const user = supabaseUser
    ? {
        id: supabaseUser.id,
        email: supabaseUser.email,
        full_name: profile?.full_name || supabaseUser.email,
        role: profile?.role || 'user',
        plan: profile?.plan || 'free',
        trial_ends_at: profile?.trial_ends_at || null,
        stripe_customer_id: profile?.stripe_customer_id || null,
        stripe_subscription_id: profile?.stripe_subscription_id || null,
        mensajes_usados_mes: profile?.mensajes_usados_mes || 0,
      }
    : null;

  const logout = async (redirectUrl = '/') => {
    await supabase.auth.signOut();
    window.location.href = redirectUrl;
  };

  const navigateToLogin = (returnUrl = window.location.href) => {
    window.location.href = `/login?next=${encodeURIComponent(returnUrl)}`;
  };

  const updateMe = async (updates) => {
    if (!supabaseUser) return;
    try {
      const data = await UserProfile.update(supabaseUser.id, updates);
      setProfile(data);
      return data;
    } catch (_) {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        supabaseUser,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError: null,
        appPublicSettings: null,
        authChecked: !isLoadingAuth,
        logout,
        navigateToLogin,
        updateMe,
        checkUserAuth: () => loadProfile(supabaseUser?.id, supabaseUser),
        checkAppState: () => {},
        refreshProfile: () => loadProfile(supabaseUser?.id, supabaseUser),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
