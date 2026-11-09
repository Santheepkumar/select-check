import type {
  AuthOtpRequest,
  AuthSessionResponse,
  AuthVerifyRequest
} from '@select-check/shared';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { getQuotaStatus, resolveCallerIdentity } from '../services/quota.js';
import type { CloudflareBindings } from '../types.js';

export const authRouter = new Hono<{ Bindings: CloudflareBindings }>();

// Pending OTP store for non-Supabase or local dev mode
const pendingOtpMap = new Map<string, string>();

authRouter.post('/otp', async (c) => {
  const env = c.env || {};
  const body = await c.req
    .json<Partial<AuthOtpRequest>>()
    .catch((): Partial<AuthOtpRequest> => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !email.includes('@')) {
    return c.json({ error: 'Please provide a valid email address.' }, 400);
  }

  // If Supabase URL & Anon Key are configured, trigger Supabase Auth OTP
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email, create_user: true })
    });
    if (!res.ok) {
      const err = await res.text();
      return c.json({ error: `Supabase OTP error: ${err}` }, 400);
    }
    return c.json({ message: 'Verification code sent to your email.' });
  }

  // Built-in passwordless OTP for edge standalone / local dev (code: 123456)
  const devCode = '123456';
  pendingOtpMap.set(email, devCode);
  return c.json({
    message: 'Verification code sent! (Demo/Dev OTP code: 123456)',
    demoCode: devCode
  });
});

authRouter.post('/verify', async (c) => {
  const env = c.env || {};
  const body = await c.req
    .json<Partial<AuthVerifyRequest>>()
    .catch((): Partial<AuthVerifyRequest> => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (!email || !token) {
    return c.json({ error: 'Email and verification code are required.' }, 400);
  }

  const jwtSecret = env.JWT_SECRET || 'select-check-dev-jwt-secret-key';

  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ type: 'email', email, token })
    });
    if (!res.ok) {
      return c.json({ error: 'Invalid or expired OTP code.' }, 401);
    }
  } else {
    const expected = pendingOtpMap.get(email) || '123456';
    if (token !== expected && token !== '123456') {
      return c.json({ error: 'Invalid verification code. Try 123456 in dev mode.' }, 401);
    }
    pendingOtpMap.delete(email);
  }

  const userId = `usr_${Buffer.from(email).toString('base64url').slice(0, 16)}`;
  const signedJwt = await sign(
    {
      sub: userId,
      email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 // 30 days
    },
    jwtSecret,
    'HS256'
  );

  const caller = await resolveCallerIdentity(`Bearer ${signedJwt}`, 'auth', env);
  const quota = await getQuotaStatus(caller, env);

  const response: AuthSessionResponse = {
    accessToken: signedJwt,
    user: { id: userId, email },
    quota
  };

  return c.json(response, 200);
});
