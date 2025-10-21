import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { systemPrompt, buildUserPrompt, simpleRecommendations } from '../utils/prompt.js';
import { callOpenAI } from '../services/openai.js';
import { getCached, setCached } from '../services/cache.js'; // <-- Importa el caché

const router = Router();

const ChatBodySchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    module: z.string().optional(),
    pageUrl: z.string().url().optional(),
    user: z.object({
      externalId: z.string().optional(),
      goals: z.array(z.string()).optional()
    }).optional()
  }).partial().default({})
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, context } = ChatBodySchema.parse(req.body);
    
    // 1. Crea una "llave" única para esta pregunta y módulo
    const key = (context.module || 'general') + '::' + message.trim().toLowerCase();

    // 2. Intenta obtener la respuesta del caché
    const cached = getCached(key);
    if (cached) {
      // Si está en caché, responde inmediatamente (sin llamar a OpenAI)
      return res.json({ answer: cached, recommendations: simpleRecommendations(context, cached) });
    }

    // 3. Si no está en caché, llama a OpenAI
    const prompt = buildUserPrompt(message, context);
    const answer = await callOpenAI(systemPrompt, prompt);

    // 4. Guarda la nueva respuesta en el caché
    setCached(key, answer);
    
    // 5. Responde al cliente
    const recommendations = simpleRecommendations(context, answer);
    res.json({ answer, recommendations });

  } catch (err) {
    next(err);
  }
});

export default router;