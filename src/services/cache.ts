const cache = new Map<string, { answer: string; ts: number }>();
const TTL_MS = 1000 * 60 * 60; // 1 hora (Time-To-Live, cuánto dura la respuesta guardada)

export function getCached(key: string) {
  const v = cache.get(key);
  if (!v) return null;
  // Borra la entrada si ya expiró (más de 1 hora)
  if (Date.now() - v.ts > TTL_MS) { 
    cache.delete(key); 
    return null; 
  }
  return v.answer;
}

export function setCached(key: string, answer: string) {
  cache.set(key, { answer, ts: Date.now() });
}