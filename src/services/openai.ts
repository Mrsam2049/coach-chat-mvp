import { ENV } from '../config/env.js';

// Asegura que MOCK solo se active fuera de producción
const MOCK = process.env.NODE_ENV !== 'production' && process.env.MOCK_OPENAI === '1';

export async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (MOCK) return `Respuesta simulada ✅\n\nMensaje: "${userPrompt.slice(0, 140)}..."`;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12000); // 12 segundos de timeout

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ENV.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: ENV.OPENAI_MODEL,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: ac.signal // Conecta el AbortController
    });
    
    // Limpia el temporizador si la respuesta llega a tiempo
    clearTimeout(t); 

    const text = await resp.text();
    
    if (!resp.ok) {
      const err: any = new Error(`OpenAI error ${resp.status}: ${text}`);
      err.status = resp.status;
      throw err;
    }
    
    try {
      const data = JSON.parse(text);
      return data?.choices?.[0]?.message?.content ?? 'No pude generar respuesta.';
    } catch {
      const err: any = new Error('Respuesta inválida de OpenAI');
      err.status = 502;
      throw err;
    }

  } catch (e: any) {
    clearTimeout(t);
    // Maneja el error de AbortController (timeout)
    if (e.name === 'AbortError') {
      const err: any = new Error('Timeout al llamar a OpenAI (12s)');
      err.status = 504;
      throw err;
    }
    // Lanza cualquier otro error
    throw e;
  }
}