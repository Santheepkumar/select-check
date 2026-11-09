import {
  AUTHENTICATED_DAILY_LIMIT,
  FREE_DEVICE_DAILY_LIMIT,
  type QuotaInfo
} from '@select-check/shared';
import { verify } from 'hono/jwt';
import type { CloudflareBindings } from '../types.js';

// In-memory KV fallback for local development or unit tests when Cloudflare KV binding is absent
const memoryKv = new Map<string, number>();

export function resetMemoryQuotaForTests(): void {
  memoryKv.clear();
}

export interface CallerIdentity {
  actorId: string;
  tier: 'free_device' | 'authenticated';
  email?: string;
  limit: number;
}

export function getUtcDayKey(now = new Date()): {
  dayStr: string;
  resetsAt: string;
} {
  const dayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
  );
  return {
    dayStr,
    resetsAt: tomorrow.toISOString()
  };
}

export async function resolveCallerIdentity(
  authHeader: string | undefined,
  deviceId: string,
  env: CloudflareBindings = {}
): Promise<CallerIdentity> {
  const freeLimit = Number(env.FREE_DAILY_LIMIT || FREE_DEVICE_DAILY_LIMIT);
  const authLimit = Number(env.AUTH_DAILY_LIMIT || AUTHENTICATED_DAILY_LIMIT);
  const jwtSecret = env.JWT_SECRET || 'select-check-dev-jwt-secret-key';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) {
      try {
        const payload = await verify(token, jwtSecret, 'HS256');
        if (payload && typeof payload.sub === 'string') {
          return {
            actorId: `user:${payload.sub}`,
            tier: 'authenticated',
            email: typeof payload.email === 'string' ? payload.email : undefined,
            limit: authLimit
          };
        }
      } catch {
        // Invalid or expired token falls back to device quota
      }
    }
  }

  return {
    actorId: `device:${deviceId}`,
    tier: 'free_device',
    limit: freeLimit
  };
}

export async function getQuotaStatus(
  caller: CallerIdentity,
  env: CloudflareBindings = {}
): Promise<QuotaInfo> {
  const { dayStr, resetsAt } = getUtcDayKey();
  const key = `quota:${caller.actorId}:${dayStr}`;

  let used = 0;
  if (env.QUOTA_KV) {
    const raw = await env.QUOTA_KV.get(key);
    used = raw ? parseInt(raw, 10) || 0 : 0;
  } else {
    used = memoryKv.get(key) || 0;
  }

  return {
    used,
    limit: caller.limit,
    tier: caller.tier,
    resetsAt
  };
}

export async function incrementQuota(
  caller: CallerIdentity,
  env: CloudflareBindings = {}
): Promise<QuotaInfo> {
  const { dayStr, resetsAt } = getUtcDayKey();
  const key = `quota:${caller.actorId}:${dayStr}`;

  const current = await getQuotaStatus(caller, env);
  const nextUsed = current.used + 1;

  if (env.QUOTA_KV) {
    await env.QUOTA_KV.put(key, String(nextUsed), {
      expirationTtl: 60 * 60 * 26 // 26 hours
    });
  } else {
    memoryKv.set(key, nextUsed);
  }

  return {
    used: nextUsed,
    limit: caller.limit,
    tier: caller.tier,
    resetsAt
  };
}
