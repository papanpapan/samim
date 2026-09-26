import path from 'path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/environment';
import { openApiDocument } from './docs/openapi';
import v1Routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware';

export function createApp() {
  const app = express();

  // Security headers (NFR-SEC-01). Relax CSP in dev so Swagger UI can load.
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production'
        ? undefined
        : {
          useDefaults: true,
          directives: {
            'img-src': ["'self'", 'data:', 'blob:'],
            'script-src': ["'self'", "'unsafe-inline'"],
            'style-src': ["'self'", "'unsafe-inline'"],
          },
        },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  // Keep JSON small; large media goes through Multer uploads, not raw JSON bodies.
  app.use(express.json({ limit: '2mb' }));
  app.use(
    '/api/uploads',
    rateLimit({
      windowMs: 60_000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    express.static(path.join(process.cwd(), 'uploads'), {
      index: false,
      redirect: false,
      fallthrough: false,
    }),
  );
  app.use(express.urlencoded({ extended: true }));
  // Live board / intrusion poll / frames are a steady stream; keep them out of access logs + rate cap.
  const skipLiveWatch = (req: Request) => req.originalUrl.includes('/api/v1/live/');
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', { skip: skipLiveWatch }));

  // Rate limiting (NFR-SEC-01: max 100 req/min per IP by default).
  app.use(
    '/api',
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => skipLiveWatch(req) || req.originalUrl.startsWith('/api/docs'),
    }),
  );

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'SN-ERMS API', version: '3.0.0', time: new Date().toISOString() });
  });

  if (env.ENABLE_API_DOCS) {
    app.get('/api/docs.json', (_req: Request, res: Response) => {
      res.json(openApiDocument);
    });
    app.use(
      '/api/docs',
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument as unknown as Record<string, unknown>, {
        customSiteTitle: 'SN-ERMS API Docs',
        swaggerOptions: {
          persistAuthorization: true,
          docExpansion: 'list',
          filter: true,
          tryItOutEnabled: true,
        },
      }),
    );
  }

  app.use('/api/v1', v1Routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
