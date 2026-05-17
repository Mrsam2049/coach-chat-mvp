import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env.js';

/**
 * supabaseAdmin — usa la SERVICE ROLE key.
 * ⚠️ Esta key BYPASSEA Row Level Security. Úsala SOLO para operaciones
 * administrativas que un usuario normal no puede hacer (crear usuarios,
 * leer authorized_users, etc.). NUNCA para servir datos de una alumna
 * a partir de su request.
 */
export const supabaseAdmin = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * supabaseForUser — cliente con la ANON key + el JWT de la alumna.
 * Todas las queries pasan por PostgREST como ese usuario, así que las
 * políticas RLS SÍ se aplican. Esta es la capa real de aislamiento de
 * datos (defensa en profundidad junto a los filtros .eq('user_id')).
 */
export function supabaseForUser(accessToken: string) {
  return createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
