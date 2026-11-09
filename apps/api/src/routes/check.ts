import type { CheckRequest, CheckResponse } from '@select-check/shared';
import { Hono } from 'hono';
import { generateGrammarSuggestions } from '../services/openai.js';
import {
  getQuotaStatus,
  incrementQuota,
  resolveCallerIdentity
} from '../services/quota.js';
import type { CloudflareBindings } from '../types.js';

export const checkRouter = new Hono<{ Bindings: CloudflareBindings }>();

checkRouter.get('/quota', async (c) => {
  const env = c.env || {};
  const deviceId = c.req.header('X-Device-Id') || c.req.query('deviceId') || 'anonymous-device';
  const authHeader = c.req.header('Authorization');
  const caller = await resolveCallerIdentity(authHeader, deviceId, env);
  const quota = await getQuotaStatus(caller, env);
  return c.json({ quota });
});

checkRouter.post('/check', async (c) => {
  const env = c.env || {};
  let body: Partial<CheckRequest>;
  try {
    body = await c.req.json<Partial<CheckRequest>>();
  } catch {
    return c.json({ error: 'Invalid JSON request body' }, 400);
  }

  const rawText = typeof body.text === 'string' ? body.text.trim() : '';
  const deviceId =
    (typeof body.deviceId === 'string' && body.deviceId.trim()) ||
    c.req.header('X-Device-Id') ||
    'anonymous-device';

  if (rawText.length < 2) {
    return c.json({ error: 'Selected text must be at least 2 characters long.' }, 400);
  }
  if (rawText.length > 2000) {
    return c.json({ error: 'Selected text exceeds the 2,000 character limit.' }, 400);
  }

  const authHeader = c.req.header('Authorization');
  const caller = await resolveCallerIdentity(authHeader, deviceId, env);
  const currentQuota = await getQuotaStatus(caller, env);

  if (currentQuota.used >= currentQuota.limit) {
    return c.json(
      {
        error:
          caller.tier === 'free_device'
            ? 'Daily free limit reached (10/10 checks). Sign in to unlock 100 checks/day!'
            : 'Daily quota reached (100/100 checks). Quota resets at midnight UTC.',
        quota: currentQuota
      },
      429
    );
  }

  const result = await generateGrammarSuggestions(rawText, env);
  const updatedQuota = await incrementQuota(caller, env);

  // Optionally log usage in D1 if configured
  if (env.DB) {
    try {
      await env.DB.prepare(
        'INSERT INTO usage_logs (actor_id, actor_tier, char_count, detected_language) VALUES (?, ?, ?, ?)'
      )
        .bind(caller.actorId, caller.tier, rawText.length, result.detectedLanguage)
        .run();
    } catch {
      // Non-blocking audit log
    }
  }

  const payload: CheckResponse = {
    detectedLanguage: result.detectedLanguage,
    originalText: rawText,
    suggestions: result.suggestions,
    quota: updatedQuota
  };

  return c.json(payload, 200);
});
