import { serve } from '@hono/node-server';
import { app } from './index.js';

const port = Number(process.env.PORT || 8787);

console.log(`🚀 SelectCheck Edge API running on http://localhost:${port}`);

serve({
  fetch: (req) =>
    app.fetch(req, {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      JWT_SECRET: process.env.JWT_SECRET || 'select-check-dev-jwt-secret-key',
      FREE_DAILY_LIMIT: process.env.FREE_DAILY_LIMIT || '10',
      AUTH_DAILY_LIMIT: process.env.AUTH_DAILY_LIMIT || '100'
    }),
  port
});
