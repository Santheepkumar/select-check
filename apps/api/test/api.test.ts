import type { AuthSessionResponse, CheckResponse } from '@select-check/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { resetMemoryQuotaForTests } from '../src/services/quota.js';

describe('SelectCheck Cloudflare Worker API', () => {
  beforeEach(() => {
    resetMemoryQuotaForTests();
  });

  it('returns health status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string };
    expect(data.status).toBe('ok');
  });

  it('rejects too-short text on POST /v1/check', async () => {
    const res = await app.request('/v1/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'a', deviceId: 'dev-1' })
    });
    expect(res.status).toBe(400);
  });

  it('returns 3 distinct grammar & rewrite suggestions and tracks quota', async () => {
    const res = await app.request('/v1/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'me and him goes to the store yesterday for buy milk',
        deviceId: 'dev-test-123'
      })
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as CheckResponse;

    expect(body.detectedLanguage).toBe('EN');
    expect(body.suggestions).toHaveLength(3);
    expect(body.suggestions[0].style).toBe('grammar_fix');
    expect(body.suggestions[0].text).toContain('He and I went');
    expect(body.suggestions[1].style).toBe('clear_concise');
    expect(body.suggestions[2].style).toBe('professional_polished');

    expect(body.quota.used).toBe(1);
    expect(body.quota.limit).toBe(10);
    expect(body.quota.tier).toBe('free_device');
  });

  it('enforces the 10 checks/day limit for anonymous devices and returns 429', async () => {
    const deviceId = 'dev-rate-limit';

    for (let i = 0; i < 10; i++) {
      const res = await app.request('/v1/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `test sentence number ${i} that needs grammer check`,
          deviceId
        })
      });
      expect(res.status).toBe(200);
    }

    // 11th request must be rate-limited with 429
    const blockedRes = await app.request('/v1/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'eleventh check should be blocked until login',
        deviceId
      })
    });

    expect(blockedRes.status).toBe(429);
    const errBody = (await blockedRes.json()) as {
      error: string;
      quota: { used: number; limit: number };
    };
    expect(errBody.quota.used).toBe(10);
    expect(errBody.quota.limit).toBe(10);
  });

  it('unlocks 100 checks/day quota after signing in with Email OTP', async () => {
    const otpRes = await app.request('/v1/auth/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com' })
    });
    expect(otpRes.status).toBe(200);

    const verifyRes = await app.request('/v1/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', token: '123456' })
    });
    expect(verifyRes.status).toBe(200);
    const session = (await verifyRes.json()) as AuthSessionResponse;

    expect(session.accessToken).toBeTruthy();
    expect(session.quota.tier).toBe('authenticated');
    expect(session.quota.limit).toBe(100);

    // Check with Bearer token
    const checkRes = await app.request('/v1/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`
      },
      body: JSON.stringify({
        text: 'i dont know why teh build failed',
        deviceId: 'dev-rate-limit'
      })
    });
    expect(checkRes.status).toBe(200);
    const checkBody = (await checkRes.json()) as CheckResponse;
    expect(checkBody.quota.tier).toBe('authenticated');
    expect(checkBody.quota.limit).toBe(100);
    expect(checkBody.quota.used).toBe(1);
  });

  it('honors custom slot3Config (e.g. casual_friendly or bullet_points)', async () => {
    const res = await app.request('/v1/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'me and him goes to the store yesterday for buy milk',
        deviceId: 'dev-slot3-test',
        slot3Config: {
          preset: 'casual_friendly'
        }
      })
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as CheckResponse;
    expect(body.suggestions).toHaveLength(3);
    expect(body.suggestions[2].style).toBe('casual_friendly');
    expect(body.suggestions[2].label).toBe('Casual & Friendly');
    expect(body.suggestions[2].text).toContain('Hey!');
  });
});
