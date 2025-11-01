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

  // ✅ ENV.ALLOWED_ORIGINS YA ES UN ARRAY (viene parseado en env.ts)
  // lo convertimos a Set para búsqueda O(1)
  const allowed = new Set(ENV.ALLOWED_ORIGINS);

  // Middleware CORS que SOLO vamos a aplicar sobre /api/*
  const apiCors = cors({
    origin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
      // 1. Permite llamadas sin Origin (curl, Postman, etc.)
      if (!origin || origin === 'null') {
        return cb(null, true);
      }

      // 2. Permite orígenes que estén en la lista blanca (Render, Kajabi, etc.)
      if (allowed.has(origin)) {
        return cb(null, true);
      }

      // 3. Bloquea el resto
      return cb(new Error(`CORS bloqueado: ${origin}`));
    },
    credentials: false
  });

  // Rate limiting global (protege todo el server)
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  // Body parser JSON
  app.use(express.json({ limit: '50kb' }));

  // 🔎 Health check (sin CORS)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // 🧠 API protegida por CORS
  app.use('/api', apiCors);
  app.use('/api/v1/chat', chatRouter);

  // 🌐 Estáticos públicos (no pasan por CORS)
  // Esto sirve /favicon.ico si algún navegador lo pide
  app.use(express.static(path.join(__dirname, '../public')));

  // Esto sirve el widget y el chat.js
  app.use(
    '/widget',
    express.static(path.join(__dirname, '../public/widget'), { index: 'index.html' })
  );

  // 🛡️ Manejador de errores global
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || 500;
    if (ENV.NODE_ENV !== 'production') {
      console.error('HandlerError:', { status, message: err?.message });
    }
    res.status(status).json({
      error: err?.message || 'Error inesperado',
      status
    });
  });

  return app;
}
