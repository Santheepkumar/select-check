import type {
  AppSettings,
  AuthSessionResponse,
  CheckResponse,
  QuotaInfo
} from '@select-check/shared';

export async function checkGrammarWithApi(
  text: string,
  settings: AppSettings
): Promise<CheckResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-Id': settings.deviceId
  };
  if (settings.authToken) {
    headers.Authorization = `Bearer ${settings.authToken}`;
  }

  const response = await fetch(`${settings.apiUrl}/v1/check`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      deviceId: settings.deviceId
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `API request failed (${response.status})`);
  }

  return data as CheckResponse;
}

export async function fetchQuotaStatus(settings: AppSettings): Promise<QuotaInfo> {
  const headers: Record<string, string> = {
    'X-Device-Id': settings.deviceId
  };
  if (settings.authToken) {
    headers.Authorization = `Bearer ${settings.authToken}`;
  }

  const response = await fetch(`${settings.apiUrl}/v1/quota`, { headers });
  if (!response.ok) {
    throw new Error('Unable to fetch quota status');
  }
  const data = (await response.json()) as { quota: QuotaInfo };
  return data.quota;
}

export async function requestEmailOtp(
  email: string,
  settings: AppSettings
): Promise<{ message: string; demoCode?: string }> {
  const response = await fetch(`${settings.apiUrl}/v1/auth/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to send verification code');
  }
  return data;
}

export async function verifyEmailOtp(
  email: string,
  token: string,
  settings: AppSettings
): Promise<AuthSessionResponse> {
  const response = await fetch(`${settings.apiUrl}/v1/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Invalid verification code');
  }
  return data as AuthSessionResponse;
}
