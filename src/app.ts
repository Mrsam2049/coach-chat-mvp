import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV } from './config/env.js';
import chatRouter from './routes/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(pinoHttp());
  app.use(helmet());

  // CORS con lista blanca (tipado del callback)
  const allowed = new Set(ENV.ALLOWED_ORIGINS);
  app.use(
    cors({
      origin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
        if (!origin) return cb(null, true); // permite herramientas locales
        if (allowed.has(origin)) return cb(null, true);
        return cb(new Error(`CORS bloqueado: ${origin}`));
      },
      credentials: false
    })
  );

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use(express.json({ limit: '50kb' }));

  app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

  app.use('/api/v1/chat', chatRouter);

  app.use(
    '/widget',
    express.static(path.join(__dirname, '../public/widget'), { index: 'index.html' })
  );

  // Manejador de errores en JSON con tipos
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || 500;
    if (ENV.NODE_ENV !== 'production') {
      console.error('HandlerError:', { status, message: err?.message });
    }
    res.status(status).json({ error: err?.message || 'Error inesperado', status });
  });

  return app;
}
