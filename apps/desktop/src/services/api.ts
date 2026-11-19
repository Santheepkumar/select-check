import {
  SLOT3_PRESET_MAP,
  type AppSettings,
  type AuthSessionResponse,
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

export async function checkGrammarWithDirectProvider(
  text: string,
  settings: AppSettings
): Promise<CheckResponse> {
  const { baseUrl, apiKey, model } = resolveProviderConfig(settings);

  if (settings.providerType !== 'local_ollama' && !apiKey) {
    throw new Error(
      `API key is missing for ${settings.providerType}. Please enter your key in Settings.`
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

  // Add response_format: { type: 'json_object' } for OpenAI & Groq
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
  // Strip markdown code fence if present
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
      resetsAt: 'Unlimited'
    }
  };
}

export async function testProviderConnection(
  settings: AppSettings
): Promise<ProviderConnectionResult> {
  const start = performance.now();

  if (settings.providerType === 'hosted') {
    try {
      const res = await fetch(`${settings.apiUrl}/health`);
      const latencyMs = Math.round(performance.now() - start);
      if (res.ok) {
        return {
          ok: true,
          latencyMs,
          message: `Hosted Cloudflare Edge operational (${latencyMs}ms)`
        };
      }
      return {
        ok: false,
        latencyMs,
        message: `Edge returned HTTP ${res.status}`
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: 0,
        message: err instanceof Error ? err.message : 'Connection failed'
      };
    }
  }

  const { baseUrl, apiKey, model } = resolveProviderConfig(settings);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 2
      })
    });

    const latencyMs = Math.round(performance.now() - start);

    if (res.ok) {
      return {
        ok: true,
        latencyMs,
        message: `Connected to ${model} via ${settings.providerType} (${latencyMs}ms)`
      };
    }

    const errBody = await res.text();
    return {
      ok: false,
      latencyMs,
      message: `HTTP ${res.status}: ${errBody.slice(0, 120)}`
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: 0,
      message: err instanceof Error ? err.message : 'Unable to connect to endpoint'
    };
  }
}

export async function checkGrammarWithApi(
  text: string,
  settings: AppSettings
): Promise<CheckResponse> {
  // Route to direct BYOK / local provider if configured
  if (settings.providerType !== 'hosted') {
    return checkGrammarWithDirectProvider(text, settings);
  }

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
      deviceId: settings.deviceId,
      slot3Config: {
        preset: settings.slot3Preset,
        customPrompt: settings.slot3CustomPrompt
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `API request failed (${response.status})`);
  }

  return data as CheckResponse;
}

export async function fetchQuotaStatus(settings: AppSettings): Promise<QuotaInfo> {
  if (settings.providerType !== 'hosted') {
    return {
      used: 0,
      limit: 999999,
      tier: 'unlimited_byok',
      resetsAt: 'Unlimited'
    };
  }

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
