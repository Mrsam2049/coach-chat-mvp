import 'dotenv/config';

const required = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
};

export const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '8787', 10),

  // ─── OpenAI ────────────────────────────────────────────────────────────
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  // gpt-4.1-mini: más reciente y más rápido (TTFT) que gpt-4o-mini, mismo
  // nivel de matiz para el tono. Alternativas vía env, sin tocar código:
  //   gpt-4.1-nano  → el más rápido/barato (menos matiz emocional)
  //   gpt-4.1       → más calidad, algo más lento
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
  OPENAI_VECTOR_STORE_ID: process.env.OPENAI_VECTOR_STORE_ID ?? '',
  // Tope duro de tokens de salida → acota el coste por petición (anti-abuso)
  OPENAI_MAX_OUTPUT_TOKENS: parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? '800', 10),
  // Trozos que recupera file_search. Menos = búsqueda y respuesta más rápidas
  // (a costa de algo menos de contexto del curso). 4-6 es buen punto medio.
  OPENAI_FILE_SEARCH_MAX_RESULTS: parseInt(process.env.OPENAI_FILE_SEARCH_MAX_RESULTS ?? '5', 10),

  // ─── Supabase ──────────────────────────────────────────────────────────
  // El servidor NO arranca si falta alguna de estas (antes solo OPENAI_API_KEY).
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_ANON_KEY: required('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),

  // ─── Orígenes permitidos (CORS + frame-ancestors del widget) ───────────
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8787')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
};
