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

app.route('/v1', checkRouter);
app.route('/v1/auth', authRouter);

export default app;
