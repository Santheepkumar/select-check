import {
  SLOT3_PRESET_MAP,
  type AppSettings,
  type AuthOtpRequest,
  type AuthSessionResponse,
  type AuthVerifyRequest,
  type CheckRequest,
  type CheckResponse,
  type QuotaInfo,
  type SuggestionItem,
  type SuggestionStyle
} from '@select-check/shared';

export interface ProviderConnectionResult {
  ok: boolean;
  latencyMs: number;
  message: string;
}

function resolveProviderConfig(settings: AppSettings): {
  baseUrl: string;
  apiKey: string;
  model: string;
} {
  switch (settings.providerType) {
    case 'byok_groq':
      return {
        baseUrl: (settings.customBaseUrl || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
        apiKey: settings.customApiKey || '',
        model: settings.customModel || 'llama-3.3-70b-versatile'
      };
    case 'local_ollama':
      return {
        baseUrl: (settings.customBaseUrl || 'http://localhost:11434/v1').replace(/\/+$/, ''),
        apiKey: settings.customApiKey || 'ollama',
        model: settings.customModel || 'llama3.2'
      };
    case 'custom_openai':
      return {
        baseUrl: (settings.customBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, ''),
        apiKey: settings.customApiKey || '',
        model: settings.customModel || 'gpt-4o-mini'
      };
    case 'byok_openai':
    default:
      return {
        baseUrl: (settings.customBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, ''),
        apiKey: settings.customApiKey || '',
        model: settings.customModel || 'gpt-4o-mini'
      };
  }
}

export function resolveApiEndpoint(baseUrl: string, path: string): string {
  const cleanBase = (baseUrl || 'http://localhost:8787').trim().replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If user included /v1 or /api in their baseUrl, avoid duplicate prefixes
  if (cleanBase.endsWith('/v1') && cleanPath.startsWith('/v1')) {
    return `${cleanBase}${cleanPath.substring(3)}`;
  }
  if (cleanBase.endsWith('/api') && cleanPath.startsWith('/api')) {
    return `${cleanBase}${cleanPath.substring(4)}`;
  }
  return `${cleanBase}${cleanPath}`;
}

export async function checkGrammarWithDirectProvider(
  text: string,
  settings: AppSettings
): Promise<CheckResponse> {
  const { baseUrl, apiKey, model } = resolveProviderConfig(settings);

  if (settings.providerType !== 'local_ollama' && !apiKey) {
    throw new Error(
      `API key is missing for ${settings.providerType}. Please configure in Settings.`
    );
  }

  const presetKey = settings.slot3Preset || 'professional_polished';
  const presetMeta = SLOT3_PRESET_MAP[presetKey] || SLOT3_PRESET_MAP.professional_polished;
  const slot3Instruction =
    presetKey === 'custom' && settings.slot3CustomPrompt
      ? settings.slot3CustomPrompt
      : presetMeta.systemInstruction;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const systemPrompt =
    `You are an expert multilingual grammar checker and writing assistant. Analyze the user text and reply with a raw JSON object only (no markdown, no backticks, no code block wrapper).\n` +
    `Format must match this exact JSON structure:\n` +
    `{\n` +
    `  "detectedLanguage": "EN",\n` +
    `  "grammarFix": { "text": "...", "summary": "3-6 word summary" },\n` +
    `  "clearConcise": { "text": "...", "summary": "3-6 word summary" },\n` +
    `  "slotThree": { "text": "...", "summary": "3-6 word summary" }\n` +
    `}\n` +
    `Rules for the 3 suggestions:\n` +
    `1. grammarFix: Fix only grammar, spelling, and punctuation with minimal word changes.\n` +
    `2. clearConcise: Natural, crisp, direct rewrite for maximum readability.\n` +
    `3. slotThree: ${slot3Instruction}\n` +
    `Maintain the input text language unless instructed otherwise.`;

  const bodyPayload: Record<string, unknown> = {
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ]
  };

  if (settings.providerType === 'byok_openai' || settings.providerType === 'byok_groq') {
    bodyPayload.response_format = { type: 'json_object' };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Provider API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  let rawContent = data.choices?.[0]?.message?.content || '';
  if (rawContent.includes('```')) {
    rawContent = rawContent.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '');
  }

  let parsed: {
    detectedLanguage?: string;
    grammarFix?: { text?: string; summary?: string };
    clearConcise?: { text?: string; summary?: string };
    slotThree?: { text?: string; summary?: string };
  };

  try {
    parsed = JSON.parse(rawContent.trim());
  } catch {
    throw new Error('Provider returned non-JSON response payload.');
  }

  const slot3Style: SuggestionStyle =
    presetKey === 'custom' ? 'custom_slot' : (presetKey as SuggestionStyle);

  const suggestions: [SuggestionItem, SuggestionItem, SuggestionItem] = [
    {
      style: 'grammar_fix',
      label: 'Grammar Fix',
      text: parsed.grammarFix?.text || text,
      summary: parsed.grammarFix?.summary || 'Fixed grammar & spelling'
    },
    {
      style: 'clear_concise',
      label: 'Clear & Concise',
      text: parsed.clearConcise?.text || text,
      summary: parsed.clearConcise?.summary || 'Improved clarity'
    },
    {
      style: slot3Style,
      label: presetMeta.label,
      text: parsed.slotThree?.text || text,
      summary: parsed.slotThree?.summary || presetMeta.description
    }
  ];

  return {
    detectedLanguage: parsed.detectedLanguage || 'EN',
    originalText: text,
    suggestions,
    quota: {
      used: 0,
      limit: 999999,
      tier: 'unlimited_byok',
      resetsAt: new Date(Date.now() + 86400000).toISOString()
    }
  };
}

export async function checkGrammar(text: string, settings: AppSettings): Promise<CheckResponse> {
  if (settings.providerType && settings.providerType !== 'hosted') {
    return checkGrammarWithDirectProvider(text, settings);
  }

  const payload: CheckRequest = {
    text,
    deviceId: settings.deviceId,
    slot3Config: {
      preset: settings.slot3Preset,
      customPrompt: settings.slot3CustomPrompt
    }
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (settings.authToken) {
    headers.Authorization = `Bearer ${settings.authToken}`;
  }

  // Gracefully try /v1/check first, then /api/check, then /check
  const candidateUrls = [
    resolveApiEndpoint(settings.apiUrl, '/v1/check'),
    resolveApiEndpoint(settings.apiUrl, '/api/check'),
    resolveApiEndpoint(settings.apiUrl, '/check')
  ];

  let lastError: Error | null = null;
  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 404) {
        continue;
      }

      const errorBody = await response.text();
      throw new Error(`API Error ${response.status}: ${errorBody}`);
    } catch (err: unknown) {
      if (err instanceof Error && !err.message.includes('404')) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('API Error 404: Endpoint not found on server.');
}

export async function testProviderConnection(
  settings: AppSettings
): Promise<ProviderConnectionResult> {
  const start = performance.now();
  try {
    const res = await checkGrammarWithDirectProvider('Testing connection.', settings);
    const latencyMs = Math.round(performance.now() - start);
    return {
      ok: Boolean(res.suggestions?.length),
      latencyMs,
      message: `Connected successfully (${latencyMs}ms)`
    };
  } catch (err: unknown) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      message: err instanceof Error ? err.message : String(err)
    };
  }
}

export async function sendOtp(apiUrl: string, email: string): Promise<{ success: boolean; message: string }> {
  const payload: AuthOtpRequest = { email };
  const candidateUrls = [
    resolveApiEndpoint(apiUrl, '/v1/auth/otp'),
    resolveApiEndpoint(apiUrl, '/api/auth/otp'),
    resolveApiEndpoint(apiUrl, '/auth/otp')
  ];

  let lastError: Error | null = null;
  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        return await res.json();
      }
      if (res.status === 404) {
        continue;
      }
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to send verification code.');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError || new Error('Failed to reach auth endpoint.');
}

export async function verifyOtp(apiUrl: string, email: string, token: string): Promise<AuthSessionResponse> {
  const payload: AuthVerifyRequest = { email, token };
  const candidateUrls = [
    resolveApiEndpoint(apiUrl, '/v1/auth/verify'),
    resolveApiEndpoint(apiUrl, '/api/auth/verify'),
    resolveApiEndpoint(apiUrl, '/auth/verify')
  ];

  let lastError: Error | null = null;
  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        return await res.json();
      }
      if (res.status === 404) {
        continue;
      }
      const errorText = await res.text();
      throw new Error(errorText || 'Invalid verification code.');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError || new Error('Failed to reach auth verify endpoint.');
}
