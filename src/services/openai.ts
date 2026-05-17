/**
 * Aurora — Servicio OpenAI
 * ──────────────────────────────────────────────────────────────────────────
 * callOpenAI   → respuesta completa (para caché / respuesta simple)
 * streamOpenAI → streaming SSE delta a delta
 *
 * Ambas funciones aceptan `vectorStoreId` dinámico para soportar
 * la estrategia de VS por módulo.
 */

import OpenAI from 'openai';
import { ENV } from '../config/env.js';

const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

function fileSearchTool(vsId: string) {
  return {
    type: 'file_search' as const,
    vector_store_ids: [vsId],
    max_num_results: ENV.OPENAI_FILE_SEARCH_MAX_RESULTS,
  };
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface StreamHandlers {
  vectorStoreId?: string;
  onToolStatus:   (status: string) => void;
  onTextDelta:    (chunk: string) => void;
  onDone:         () => void;
}

// ─── callOpenAI ──────────────────────────────────────────────────────────────

export async function callOpenAI(
  system:        string,
  userMessage:   string,
  vectorStoreId?: string,
): Promise<string> {

  const vsId = vectorStoreId ?? ENV.OPENAI_VECTOR_STORE_ID;
  const t0 = Date.now();

  const response = await openai.responses.create({
    model: ENV.OPENAI_MODEL,
    max_output_tokens: ENV.OPENAI_MAX_OUTPUT_TOKENS,
    input: [
      { role: 'system', content: system },
      { role: 'user',   content: userMessage },
    ],
    tools: [fileSearchTool(vsId)],
  });

  console.log(`[openai] callOpenAI total=${Date.now() - t0}ms model=${ENV.OPENAI_MODEL}`);

  // Extraer solo el texto de la respuesta (ignorar tool_call chunks)
  const text = response.output
    ?.filter((item: any) => item.type === 'message')
    ?.flatMap((item: any) => item.content ?? [])
    ?.filter((c: any) => c.type === 'output_text')
    ?.map((c: any) => c.text)
    ?.join('') ?? '';

  return text;
}

// ─── streamOpenAI ────────────────────────────────────────────────────────────

export async function streamOpenAI(
  system:       string,
  userMessage:  string,
  handlers:     StreamHandlers,
): Promise<void> {

  const vsId = handlers.vectorStoreId ?? ENV.OPENAI_VECTOR_STORE_ID;

  const t0 = Date.now();
  let tSearch = 0;
  let tFirstToken = 0;

  const stream = await openai.responses.stream({
    model: ENV.OPENAI_MODEL,
    max_output_tokens: ENV.OPENAI_MAX_OUTPUT_TOKENS,
    input: [
      { role: 'system', content: system },
      { role: 'user',   content: userMessage },
    ],
    tools: [fileSearchTool(vsId)],
  });

  for await (const event of stream) {
    // Evento de búsqueda en progreso
    if (event.type === 'response.output_item.added' && event.item?.type === 'file_search_call') {
      tSearch = Date.now() - t0;
      handlers.onToolStatus('Consultando la base de conocimiento de Aurora...');
      continue;
    }

    // Delta de texto
    if (
      event.type === 'response.output_text.delta' &&
      typeof event.delta === 'string'
    ) {
      if (!tFirstToken) {
        tFirstToken = Date.now() - t0;
        console.log(`[openai] stream search=${tSearch}ms TTFT=${tFirstToken}ms model=${ENV.OPENAI_MODEL}`);
      }
      handlers.onTextDelta(event.delta);
      continue;
    }

    // Respuesta completa
    if (event.type === 'response.completed') {
      console.log(`[openai] stream total=${Date.now() - t0}ms`);
      handlers.onDone();
      return;
    }
  }

  // Fallback por si el stream termina sin evento completed
  console.log(`[openai] stream total=${Date.now() - t0}ms (sin evento completed)`);
  handlers.onDone();
}
