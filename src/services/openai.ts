import OpenAI from 'openai';
import { ENV } from '../config/env.js';

// Solo permitir MOCK fuera de producción
const MOCK = process.env.NODE_ENV !== 'production' && process.env.MOCK_OPENAI === '1';
console.log('VECTOR STORE ID:', ENV.OPENAI_VECTOR_STORE_ID);
const client = new OpenAI({
  apiKey: ENV.OPENAI_API_KEY
});

export async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (MOCK) {
    return `Respuesta simulada ✅\n\nMensaje: "${userPrompt.slice(0, 140)}..."`;
  }

  if (!ENV.OPENAI_VECTOR_STORE_ID) {
    const err: any = new Error('Falta OPENAI_VECTOR_STORE_ID en variables de entorno.');
    err.status = 500;
    throw err;
  }

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 20000);

  try {
    const response = await client.responses.create(
      {
        model: ENV.OPENAI_MODEL,
        temperature: 0.3,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: systemPrompt }]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: userPrompt }]
          }
        ],
        tools: [
          {
            type: 'file_search',
            vector_store_ids: [ENV.OPENAI_VECTOR_STORE_ID],
            max_num_results: 8
          }
        ]
      },
      {
        signal: ac.signal
      }
    );

    clearTimeout(timeout);

    const text = response.output_text?.trim();
    return text || 'No pude generar respuesta.';
  } catch (e: any) {
    clearTimeout(timeout);

    if (e.name === 'AbortError') {
      const err: any = new Error('Timeout al llamar a OpenAI (20s)');
      err.status = 504;
      throw err;
    }

    const err: any = new Error(e?.message || 'Error al consultar OpenAI');
    err.status = e?.status || 500;
    throw err;
  }
}