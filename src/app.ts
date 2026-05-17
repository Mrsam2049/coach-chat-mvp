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
const __dirname  = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(pinoHttp());

  // ═══════════════════════════════════════════════════════════════════════
  //  SECURITY HEADERS GLOBALES (Helmet)
  // ═══════════════════════════════════════════════════════════════════════
  //  CSP estricto, HSTS 1 año, noSniff, frame-ancestors:none.
  //  Solo /widget (más abajo) sobreescribe puntualmente.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc:  ["'self'", "https://cdn.jsdelivr.net"],
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
          frameAncestors: ["'none'"],           // ← clickjacking protección portal/API
          upgradeInsecureRequests: []
        }
      },
      strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
      noSniff:        true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Desactivar globalmente — lo seteamos a 'cross-origin' solo en /widget
      crossOriginResourcePolicy: false,
    })
  );

  // ═══════════════════════════════════════════════════════════════════════
  //  CORS — DOS POLÍTICAS
  // ═══════════════════════════════════════════════════════════════════════

  // Portal y endpoints privados: lista blanca cerrada
  const allowed = new Set(ENV.ALLOWED_ORIGINS);
  const portalCors = cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);           // same-origin / curl interno
      if (allowed.has(origin)) return cb(null, true);
      return cb(new Error(`CORS bloqueado: ${origin}`));
    },
    credentials:    false,
    methods:        ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  // Widget público (Kajabi y futuras integraciones): CORS abierto
  // Es seguro porque el endpoint widget-stream no expone datos privados,
  // solo llama a OpenAI y devuelve texto. enforceWidgetOrigin en chat.ts
  // aplica una segunda capa que valida el referer contra ALLOWED_ORIGINS.
  const widgetCors = cors({
    origin:         true,
    credentials:    false,
    methods:        ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  RATE LIMITING DIFERENCIADO
  // ═══════════════════════════════════════════════════════════════════════
  const chatLimiter = rateLimit({
    windowMs: 60 * 1000, max: 10,
    message: { error: 'Demasiadas solicitudes al chat. Espera un momento.' },
    standardHeaders: true, legacyHeaders: false
  });
  const authLimiter = rateLimit({
    windowMs: 60 * 1000, max: 5,                    // anti brute-force
    message: { error: 'Demasiados intentos. Espera un minuto.' },
    standardHeaders: true, legacyHeaders: false
  });
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000, max: 60,
    standardHeaders: true, legacyHeaders: false
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  BODY PARSER y HEALTH CHECK
  // ═══════════════════════════════════════════════════════════════════════
  app.use(express.json({ limit: '50kb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  ENDPOINTS PÚBLICOS DEL WIDGET (CORS abierto)
  //  Van ANTES del /api/v1/chat genérico para que el routing los tome
  // ═══════════════════════════════════════════════════════════════════════
  app.options('/api/v1/chat',              widgetCors);
  app.options('/api/v1/chat/widget-stream', widgetCors);
  app.post(   '/api/v1/chat',              widgetCors, chatLimiter, chatRouter);
  app.post(   '/api/v1/chat/widget-stream', widgetCors, chatLimiter, chatRouter);

  // ═══════════════════════════════════════════════════════════════════════
  //  ENDPOINTS PRIVADOS DEL PORTAL (CORS cerrado + JWT en cada handler)
  // ═══════════════════════════════════════════════════════════════════════
  app.use('/api/v1/chat',          portalCors, chatLimiter,    chatRouter);
  app.use('/api/v1/auth',          portalCors, authLimiter,    authRouter);
  app.use('/api/v1/conversations', portalCors, generalLimiter, conversationsRouter);

  // ═══════════════════════════════════════════════════════════════════════
  //  ARCHIVOS ESTÁTICOS — WIDGET (con headers relajados controladamente)
  // ═══════════════════════════════════════════════════════════════════════
  //
  //  El widget debe poder cargarse e embeberse desde Kajabi.
  //  Relajamos DOS cosas SOLO para /widget:
  //
  //  1. frame-ancestors → permitir Kajabi y dominios en ALLOWED_ORIGINS
  //     (sin tocar el portal, que sigue con frame-ancestors:none)
  //
  //  2. Cross-Origin-Resource-Policy → 'cross-origin' para que el navegador
  //     permita descargar chat.js desde otro dominio.
  //
  //  Esto NO afecta la seguridad del portal/API porque son rutas distintas.
  const widgetCsp = [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline'",            // estilos inline del widget
    "img-src 'self' data:",
    `connect-src 'self' ${ENV.ALLOWED_ORIGINS.join(' ')} https://fijzsyjvrsbevwvjdlok.supabase.co https://cdn.jsdelivr.net`,
    "object-src 'none'",
    "base-uri 'self'",
    `frame-ancestors 'self' ${ENV.ALLOWED_ORIGINS.join(' ')}`,
    'upgrade-insecure-requests'
  ].join('; ');

  app.use('/widget', (_req: Request, res: Response, next: NextFunction) => {
    // Permite que Kajabi embeba el widget
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', widgetCsp);
    // Permite que el navegador descargue chat.js desde otro origen
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    next();
  });

  app.use(
    '/widget',
    express.static(path.join(__dirname, '../public/widget'), { index: 'index.html' })
  );

  // ═══════════════════════════════════════════════════════════════════════
  //  ARCHIVOS ESTÁTICOS — PORTAL (políticas estrictas globales)
  // ═══════════════════════════════════════════════════════════════════════
  app.use(
    '/portal',
    express.static(path.join(__dirname, '../public/portal'), { index: 'login.html' })
  );

  app.use(express.static(path.join(__dirname, '../public')));

  // ═══════════════════════════════════════════════════════════════════════
  //  ERROR HANDLER GLOBAL — nunca filtra detalles internos en producción
  // ═══════════════════════════════════════════════════════════════════════
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || 500;

    if (ENV.NODE_ENV !== 'production') {
      console.error('HandlerError:', { status, message: err?.message });
    }

    const message = ENV.NODE_ENV === 'production' && status === 500
      ? 'Error interno del servidor.'
      : err?.message || 'Error inesperado';

    res.status(status).json({ error: message });
  });

  return app;
}