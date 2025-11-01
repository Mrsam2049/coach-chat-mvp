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

  // Definición del middleware de CORS, para ser aplicado solo a la API
  const allowed = new Set(ENV.ALLOWED_ORIGINS.split(',').map(s => s.trim()));
  const apiCors = cors({
    // Tipado del callback de origen
    origin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
      // 1. Permite llamadas sin Origin (como cURL, Postman o toolkits del navegador)
      if (!origin || origin === 'null') return cb(null, true);
      
      // 2. Permite orígenes en la lista blanca
      if (allowed.has(origin)) return cb(null, true);
      
      // 3. Bloquea el resto (esto era lo que causaba el 500)
      return cb(new Error(`CORS bloqueado: ${origin}`));
    },
    credentials: false
  });

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use(express.json({ limit: '50kb' }));

  // Rutas de API con CORS aplicado
  app.use('/api', apiCors); 
  app.use('/api/v1/chat', chatRouter);

  // Endpoint de salud (no necesita CORS)
  app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

  // Servir archivos estáticos (no debe pasar por CORS)
  app.use(
    express.static(path.join(__dirname, '../public')) // Para servir /favicon.ico si existe
  );
  app.use(
    '/widget',
    express.static(path.join(__dirname, '../public/widget'), { index: 'index.html' })
  );

  // Manejador de errores en JSON
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || 500;
    if (ENV.NODE_ENV !== 'production') {
      console.error('HandlerError:', { status, message: err?.message });
    }
    res.status(status).json({ error: err?.message || 'Error inesperado', status });
  });

  return app;
}