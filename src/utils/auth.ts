import { supabaseAdmin } from '../services/supabase.js';

function extractToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

export async function getUserFromAuthHeader(authHeader?: string) {
  const ctx = await getAuthContext(authHeader);
  return ctx?.user ?? null;
}

/**
 * Verifica el JWT con Supabase (firma + expiración) y devuelve el usuario
 * junto con el token crudo, para poder construir un cliente RLS-scoped.
 */
export async function getAuthContext(authHeader?: string) {
  const token = extractToken(authHeader);
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  return { user: data.user, token };
}
