import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { authPlugin }    from './middleware/auth.js';
import { authRoutes }    from './routes/auth.js';
import { walletRoutes }  from './routes/wallet.js';
import { betsRoutes, verifyRoutes } from './routes/bets.js';
import { depositRoutes } from './routes/deposits.js';
import { gamesRoutes }   from './routes/games.js';
import { adminRoutes }   from './routes/admin.js';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
  },
});

// ─── Plugins ──────────────────────────────────────────────────────────────────

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? '*',
  credentials: true,
});

await fastify.register(rateLimit, {
  max: 120,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please wait and try again.',
  }),
});

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET,
});

// Auth decorators (authenticate, authenticateOptional)
await fastify.register(authPlugin);

// ─── Routes ───────────────────────────────────────────────────────────────────

await fastify.register(authRoutes,    { prefix: '/api/auth' });
await fastify.register(walletRoutes,  { prefix: '/api/wallet' });
await fastify.register(betsRoutes,    { prefix: '/api/bets' });
await fastify.register(verifyRoutes,  { prefix: '/api' });
await fastify.register(depositRoutes, { prefix: '/api/deposits' });
await fastify.register(gamesRoutes,   { prefix: '/api/games' });
await fastify.register(adminRoutes,   { prefix: '/api/admin' });

// Health check
fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

// Public config (vault address + chain for the frontend)
fastify.get('/api/config', async () => ({
  vaultAddress: process.env.VAULT_CONTRACT_ADDRESS ?? '',
  network:      process.env.BSC_NETWORK ?? 'bsc_testnet',
  chainId:      process.env.BSC_NETWORK === 'bsc' ? 56 : 97,
}));

// ─── Error handler ────────────────────────────────────────────────────────────

fastify.setErrorHandler((err, req, reply) => {
  const status = err.statusCode ?? 500;

  if (status >= 500) {
    fastify.log.error({ err, req }, 'Unhandled error');
  }

  // Don't leak internal errors to the client in production
  const message = status < 500 || process.env.NODE_ENV !== 'production'
    ? err.message
    : 'Internal server error';

  reply.code(status).send({ error: message });
});

// Serve frontend static files — registered last so API routes take priority
await fastify.register(staticFiles, {
  root: join(__dirname, '..', '..'),
  prefix: '/',
  index: 'Volt Casino.html',
  decorateReply: false,
  setHeaders(res, filePath) {
    if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|mp3|wav|ogg|woff2?)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
});

// ─── Start ────────────────────────────────────────────────────────────────────

try {
  await fastify.listen({ port: PORT, host: HOST });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
