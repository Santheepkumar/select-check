import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth.js';
import { checkRouter } from './routes/check.js';
import type { CloudflareBindings } from './types.js';

export const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Device-Id']
  })
);

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'select-check-api',
    timestamp: new Date().toISOString()
  })
);

// Mount routes on /v1, /api, /api/v1, and root / for maximum client compatibility
app.route('/v1', checkRouter);
app.route('/v1/auth', authRouter);

app.route('/api/v1', checkRouter);
app.route('/api/v1/auth', authRouter);

app.route('/api', checkRouter);
app.route('/api/auth', authRouter);

app.route('/', checkRouter);
app.route('/auth', authRouter);

export default app;
