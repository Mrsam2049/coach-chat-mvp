import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV } from './config/env.js';
import chatRouter from './routes/chat.js';
import authRouter from './routes/auth.js';
import conversationsRouter from './routes/conversations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(pinoHttp());

  // ─── Seguridad de headers ────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc:  ["'self'", "https://cdn.jsdelivr.net"],
          // Sin unsafe-inline: los estilos inline del portal son pocos y se pueden mover a clases
          styleSrc:   ["'self'"],
          imgSrc:     ["'self'", "data:"],
          connectSrc: [
            "'self'",
            ...ENV.ALLOWED_ORIGINS,
            "https://fijzsyjvrsbevwvjdlok.supabase.co",
            "https://cdn.jsdelivr.net"
          ],
          objectSrc:      ["'none'"],
          baseUri:        ["'self'"],
          frameAncestors: ["'none'"],          // Evita clickjacking
          upgradeInsecureRequests: []           // Fuerza HTTPS en producción
        }
      },
      // HSTS: fuerza HTTPS por 1 año
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true
      },
      // Evita que el navegador adivine el Content-Type
      noSniff: true,
      // Referrer Policy estricto
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    })
  );

  // ─── CORS ────────────────────────────────────────────────────────────────
  const allowed = new Set(ENV.ALLOWED_ORIGINS);

  const apiCors = cors({
    origin(origin, cb) {
      // Sin origin = same-origin o herramienta interna — permitir
      if (!origin) return cb(null, true);
      if (allowed.has(origin)) return cb(null, true);
      return cb(new Error(`CORS bloqueado: ${origin}`));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  // ─── Rate limiting diferenciado ──────────────────────────────────────────
  // Chat IA: máximo 10 mensajes/minuto por IP
  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Demasiadas solicitudes al chat. Espera un momento.' },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Auth (login, activate): máximo 5 intentos/minuto para frenar brute-force
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.' },
    standardHeaders: true,
    legacyHeaders: false
  });

  // General: resto de la API
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false
  });

  // ─── Body parser ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '50kb' }));

  // ─── Health check (sin rate limit) ──────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // ─── API ─────────────────────────────────────────────────────────────────
  app.use('/api', apiCors);
  app.use('/api/v1/chat',          chatLimiter,    chatRouter);
  app.use('/api/v1/auth',          authLimiter,    authRouter);
  app.use('/api/v1/conversations', generalLimiter, conversationsRouter);

  // ─── Estáticos ───────────────────────────────────────────────────────────

  // El widget DEBE poder embeberse como iframe dentro de Kajabi.
  // Helmet pone globalmente `frame-ancestors 'none'` y `X-Frame-Options`,
  // que bloquean cualquier iframe. SOLO para /widget relajamos esas dos
  // cabeceras hacia los orígenes de confianza (ALLOWED_ORIGINS + self).
  // El resto del sitio (portal, API) sigue con `frame-ancestors 'none'`.
  const widgetCsp = [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net",
    "style-src 'self'",
    "img-src 'self' data:",
    `connect-src 'self' ${ENV.ALLOWED_ORIGINS.join(' ')} https://fijzsyjvrsbevwvjdlok.supabase.co https://cdn.jsdelivr.net`,
    "object-src 'none'",
    "base-uri 'self'",
    `frame-ancestors 'self' ${ENV.ALLOWED_ORIGINS.join(' ')}`,
    'upgrade-insecure-requests'
  ].join('; ');

  app.use('/widget', (_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', widgetCsp);
    next();
  });

  app.use(
    '/widget',
    express.static(path.join(__dirname, '../public/widget'), { index: 'index.html' })
  );

  app.use(
    '/portal',
    express.static(path.join(__dirname, '../public/portal'), { index: 'login.html' })
  );

  app.use(express.static(path.join(__dirname, '../public')));

  // ─── Error handler global ────────────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || 500;

    if (ENV.NODE_ENV !== 'production') {
      console.error('HandlerError:', { status, message: err?.message });
    }

    // En producción nunca exponer detalles del error interno
    const message = ENV.NODE_ENV === 'production' && status === 500
      ? 'Error interno del servidor.'
      : err?.message || 'Error inesperado';

    res.status(status).json({ error: message });
  });

  return app;
}