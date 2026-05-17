import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// La anon key es pública por diseño (no es un secreto).
// NUNCA pongas aquí la service_role key.
const SUPABASE_URL      = document.querySelector('meta[name="sb-url"]')?.content  || '';
const SUPABASE_ANON_KEY = document.querySelector('meta[name="sb-anon"]')?.content || '';

// API_URL siempre relativa — funciona en localhost y en producción sin cambios
export const API_URL = '/api/v1';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message?.toLowerCase().includes('invalid login credentials')) {
      throw new Error('Correo o contraseña incorrectos.');
    }
    throw new Error('No fue posible iniciar sesión.');
  }

  return data;
}

export async function activate(email, password) {
  const response = await fetch(`${API_URL}/auth/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'No fue posible activar la cuenta.');
  }

  return result;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error('No fue posible cerrar sesión.');
}

export async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;
  return data.session.access_token;
}