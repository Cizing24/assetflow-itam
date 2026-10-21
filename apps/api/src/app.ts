import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import { authentication } from './auth.js';
import { errorHandler } from './errors.js';
import { routes } from './routes.js';
import { db } from './db.js';
export async function buildApp(logger = false) {
  const app = Fastify({ logger: logger ? { redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers.x-csrf-token', 'res.headers.set-cookie', '*.password', '*.passwordHash'] } : false, bodyLimit: 32768, ajv: { customOptions: { removeAdditional: false, coerceTypes: false } } });
  errorHandler(app);
  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"] } } });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(swagger, { openapi: { info: { title: 'AssetFlow REST API', version: '1.0.0', description: 'Cookie Session + Origin + X-CSRF-Token。所有寫入由後端驗證角色。' }, components: { securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'assetflow_session' }, csrfToken: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' } } } } });
  authentication(app);
  app.addHook('onSend', async (req, reply) => { if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store'); });
  app.get('/health', async () => { await db.$queryRaw`SELECT 1`; return { status: 'ok', database: 'connected' }; });
  app.get('/openapi.json', { schema: { hide: true } }, () => app.swagger());
  routes(app);
  return app;
}
