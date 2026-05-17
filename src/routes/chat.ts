import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { systemPrompt, buildUserPrompt, simpleRecommendations } from '../utils/prompt.js';
import { callOpenAI, streamOpenAI } from '../services/openai.js';
import { getCached, setCached } from '../services/cache.js';
import { getUserFromAuthHeader } from '../utils/auth.js';
import { ENV } from '../config/env.js';

const router = Router();

// Un único store maestro con TODO el conocimiento → portal y widget
// responden cualquier tema. (El enrutado por módulo se quitó porque
// hacía que se consultaran stores incompletos y faltaban respuestas.)
function selectVectorStore(_module?: string): string {
  return ENV.OPENAI_VECTOR_STORE_ID;
}

// ─── Esquema de validación ────────────────────────────────────────────────────

const ChatBodySchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    module:  z.string().max(60).optional(),
    pageUrl: z.string().url().optional(),
    user: z.object({
      externalId: z.string().max(128).optional(),
      goals:      z.array(z.string().max(60)).max(10).optional(),
    }).optional(),
  }).partial().default({})
});

// ─── Lock de origen para el endpoint público del widget ──────────────────────

function originFromReferer(referer?: string): string | null {
  if (!referer) return null;
  try { return new URL(referer).origin; } catch { return null; }
}

function enforceWidgetOrigin(req: Request, res: Response, next: NextFunction) {
  const selfOrigin = `${req.protocol}://${req.get('host')}`;
  const allowed = new Set<string>([...ENV.ALLOWED_ORIGINS, selfOrigin]);

  const origin =
    (typeof req.headers.origin === 'string' && req.headers.origin) ||
    originFromReferer(req.get('referer') ?? undefined);

  if (!origin || !allowed.has(origin)) {
    return res.status(403).json({ error: 'Origen no permitido.' });
  }

  next();
}

// ─── Auth middleware (solo para el stream del portal) ────────────────────────

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getUserFromAuthHeader(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión para usar el chat.' });
  }
  (req as any).user = user;
  next();
}

// ─── Runner SSE compartido (portal y widget usan el mismo motor) ─────────────

async function runChatStream(
  req: Request,
  res: Response,
  next: NextFunction,
  cacheScope: string,
) {
  try {
    const { message, context } = ChatBodySchema.parse(req.body);
    const vectorStoreId = selectVectorStore(context.module);
    const key = `${cacheScope}::${vectorStoreId}::${message.trim().toLowerCase()}`;

    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // evita buffering en proxies (nginx)

    const cached = getCached(key);
    if (cached) {
      res.write(`event: delta\ndata: ${JSON.stringify({ text: cached })}\n\n`);
      res.write(`event: done\ndata: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    const prompt = buildUserPrompt(message, context);
    let fullText = '';

    await streamOpenAI(systemPrompt, prompt, {
      vectorStoreId,
      onToolStatus(status) {
        res.write(`event: status\ndata: ${JSON.stringify({ text: status })}\n\n`);
      },
      onTextDelta(chunk) {
        fullText += chunk;
        res.write(`event: delta\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
      },
      onDone() {
        if (fullText) setCached(key, fullText);
        res.write(`event: done\ndata: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      },
    });
  } catch (err: any) {
    if (ENV.NODE_ENV !== 'production') console.error('[stream] error:', err?.message);
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'No se pudo generar la respuesta. Intenta de nuevo.' })}\n\n`);
      res.end();
    } catch {
      next(err);
    }
  }
}

// ─── POST /api/v1/chat  (PÚBLICO no-stream — compat, widget Kajabi) ──────────

router.post('/', enforceWidgetOrigin, async (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  try {
    const { message, context } = ChatBodySchema.parse(req.body);
    const vectorStoreId = selectVectorStore(context.module);
    const key = `public::${vectorStoreId}::${message.trim().toLowerCase()}`;

    const cached = getCached(key);
    if (cached) {
      return res.json({ answer: cached, recommendations: simpleRecommendations(context, cached) });
    }

    const prompt = buildUserPrompt(message, context);
    const answer = await callOpenAI(systemPrompt, prompt, vectorStoreId);
    console.log(`[chat] respuesta en ${Date.now() - start}ms`);

    setCached(key, answer);
    return res.json({ answer, recommendations: simpleRecommendations(context, answer) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/chat/widget-stream  (PÚBLICO streaming — widget Kajabi) ────

router.post('/widget-stream', enforceWidgetOrigin, (req: Request, res: Response, next: NextFunction) =>
  runChatStream(req, res, next, 'public')
);

// ─── POST /api/v1/chat/stream  (PRIVADO streaming — portal autenticado) ──────

router.post('/stream', requireAuth, (req: Request, res: Response, next: NextFunction) =>
  runChatStream(req, res, next, (req as any).user.id)
);

export default router;
