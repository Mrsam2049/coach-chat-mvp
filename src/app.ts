import express from 'express';

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

  // CORS con lista blanca
  const allowed = new Set(ENV.ALLOWED_ORIGINS);
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true); // permite herramientas locales
        if (allowed.has(origin)) return cb(null, true);
        return cb(new Error(`CORS bloqueado: ${origin}`));
      }
    })
  );

  // Limitador (60 req/min por IP)
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use(express.json({ limit: '50kb' }));

  // Salud
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // API
  app.use('/api/v1/chat', chatRouter);

  // Widget estático: http://localhost:8787/widget/
  app.use(
    '/widget',
    express.static(path.join(__dirname, '../public/widget'), {
      index: 'index.html'
    })
  );

  // Manejador de errores en JSON
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err?.status || 500;
    res.status(status).json({
      error: err?.message || 'Error inesperado',
      status
    });
  });

  return app;
}
