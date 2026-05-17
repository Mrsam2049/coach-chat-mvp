const cache = new Map<string, { answer: string; ts: number }>();
const TTL_MS = 1000 * 60 * 60; // 1 hora
const MAX_ENTRIES = 1000;      // tope duro → evita crecimiento ilimitado de memoria

export function getCached(key: string) {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Refresca el orden de inserción (Map mantiene orden) → comportamiento LRU
  cache.delete(key);
  cache.set(key, v);
  return v.answer;
}

export function setCached(key: string, answer: string) {
  cache.set(key, { answer, ts: Date.now() });

  // Si nos pasamos del tope, descarta primero lo expirado y luego lo más viejo.
  if (cache.size > MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.ts > TTL_MS) cache.delete(k);
    }
    while (cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }
}
