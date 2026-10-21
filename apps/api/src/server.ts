import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import staticFiles from '@fastify/static';
import { buildApp } from './app.js';
import { config } from './config.js';
import { db } from './db.js';
const app = await buildApp(true);
const webRoot = fileURLToPath(new URL('../../web/dist/', import.meta.url));
if (existsSync(webRoot)) {
  await app.register(staticFiles, { root: webRoot, wildcard: false });
}
await app.listen({ port: config.PORT, host: process.env.HOST ?? '127.0.0.1' });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); await db.$disconnect(); process.exit(0); });
