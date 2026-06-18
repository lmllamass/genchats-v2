import { supabase } from './supabaseClient';

// ── PROYECTOS ──────────────────────────────────────────────────────────────
export const Proyecto = {
  async list(userId) {
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async listAll() {
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async get(id) {
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(fields, userId) {
    const { data, error } = await supabase
      .from('proyectos')
      .insert({ ...fields, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, fields) {
    const { data, error } = await supabase
      .from('proyectos')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from('proyectos').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── LEADS ──────────────────────────────────────────────────────────────────
export const Lead = {
  async list(proyecto_id, limit = 50) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('proyecto_id', proyecto_id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async listAll(limit = 100) {
    const { data, error } = await supabase
      .from('leads')
      .select('*, proyectos(nombre)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};

// ── MENSAJES WA ────────────────────────────────────────────────────────────
export const MensajeWA = {
  async list(proyecto_id, limit = 30) {
    const { data, error } = await supabase
      .from('mensajes_wa')
      .select('*')
      .eq('proyecto_id', proyecto_id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async lastOne() {
    const { data, error } = await supabase
      .from('mensajes_wa')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0] || null;
  },
};

// ── CONFIG PLATAFORMA (admin singleton) ───────────────────────────────────
export const ConfigPlataforma = {
  async get() {
    const { data, error } = await supabase
      .from('config_plataforma')
      .select('*')
      .eq('clave', 'plataforma')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, fields) {
    const { data, error } = await supabase
      .from('config_plataforma')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ── CONFIG GLOBAL ──────────────────────────────────────────────────────────
export const ConfigGlobal = {
  async get() {
    const { data, error } = await supabase
      .from('config_global')
      .select('*')
      .eq('clave', 'global')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, fields) {
    const { data, error } = await supabase
      .from('config_global')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ── USER PROFILES ──────────────────────────────────────────────────────────
export const UserProfile = {
  async get(userId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async update(userId, fields) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(fields)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listAll() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};
