export type SuggestionStyle =
  | 'grammar_fix'
  | 'clear_concise'
  | 'professional_polished'
  | 'casual_friendly'
  | 'bullet_points'
  | 'executive_brief'
  | 'translate_spanish'
  | 'custom_slot';

export interface SuggestionItem {
  style: SuggestionStyle;
  label: string;
  text: string;
  summary: string;
}

export interface QuotaInfo {
  used: number;
  limit: number;
  tier: 'free_device' | 'authenticated' | 'unlimited_byok';
  resetsAt: string;
}

export type ProviderType =
  | 'hosted'
  | 'byok_openai'
  | 'byok_groq'
  | 'local_ollama'
  | 'custom_openai';

export type Slot3Preset =
  | 'professional_polished'
  | 'casual_friendly'
  | 'bullet_points'
  | 'executive_brief'
  | 'translate_spanish'
  | 'custom';

export interface Slot3PresetMeta {
  preset: Slot3Preset;
  label: string;
  description: string;
  systemInstruction: string;
}

export const SLOT3_PRESET_MAP: Record<Slot3Preset, Slot3PresetMeta> = {
  professional_polished: {
    preset: 'professional_polished',
    label: 'Professional & Polished',
    description: 'Elevated, workplace-ready, polite tone.',
    systemInstruction:
      'Elevated, polite, and executive-ready professional rewrite in the same language.'
  },
  casual_friendly: {
    preset: 'casual_friendly',
    label: 'Casual & Friendly',
    description: 'Warm, conversational, and approachable tone.',
    systemInstruction:
      'Warm, friendly, and approachable casual rewrite in the same language.'
  },
  bullet_points: {
    preset: 'bullet_points',
    label: 'Key Bullet Points',
    description: 'Crisp summary organized into actionable bullet points.',
    systemInstruction:
      'Condense into 2 to 4 crisp, actionable bullet points formatted with markdown bullets.'
  },
  executive_brief: {
    preset: 'executive_brief',
    label: 'Executive Brief (TL;DR)',
    description: 'High-signal 1-2 sentence executive briefing.',
    systemInstruction:
      'High-signal, punchy 1-2 sentence executive briefing focusing only on the core takeaway.'
  },
  translate_spanish: {
    preset: 'translate_spanish',
    label: 'Translate to Spanish',
    description: 'Accurate and natural Spanish translation.',
    systemInstruction:
      'Translate the text into natural, fluent Spanish with proper grammar and accents.'
  },
  custom: {
    preset: 'custom',
    label: 'Custom Persona',
    description: 'User-specified prompt transformation.',
    systemInstruction: 'Follow the custom user instruction precisely.'
  }
};

export interface Slot3RequestConfig {
  preset: Slot3Preset;
  customPrompt?: string;
}

export interface CheckRequest {
  text: string;
  deviceId: string;
  slot3Config?: Slot3RequestConfig;
}

export interface CheckResponse {
  detectedLanguage: string;
  originalText: string;
  suggestions: [SuggestionItem, SuggestionItem, SuggestionItem];
  quota: QuotaInfo;
}

export interface AuthOtpRequest {
  email: string;
}

export interface AuthVerifyRequest {
  email: string;
  token: string;
}

export interface AuthSessionResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
  quota: QuotaInfo;
}

export interface AppSettings {
  autoShowOnSelect: boolean;
  autoHideSeconds: number;
  showWordDiff: boolean;
  globalShortcut: string;
  blockedApps: string[];
  apiUrl: string;
  deviceId: string;
  authToken?: string;
  userEmail?: string;
  // Anti-Grammarly expansions
  providerType: ProviderType;
  customApiKey?: string;
  customBaseUrl?: string;
  customModel?: string;
  slot3Preset: Slot3Preset;
  slot3CustomPrompt?: string;
  skipCodeAndNumbers: boolean;
  triggerMode: 'auto_mouse' | 'hotkey_only';
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoShowOnSelect: true,
  autoHideSeconds: 4,
  showWordDiff: true,
  globalShortcut: 'CommandOrControl+Shift+G',
  blockedApps: [
    'Terminal',
    'iTerm2',
    'Warp',
    'Alacritty',
    'WindowsTerminal',
    'cmd.exe',
    'powershell.exe'
  ],
  apiUrl: 'https://select-check-api.santheepkumar.workers.dev',
  deviceId: 'dev_local_desktop',
  providerType: 'hosted',
  slot3Preset: 'professional_polished',
  skipCodeAndNumbers: true,
  triggerMode: 'auto_mouse'
};

export const DEFAULT_BLOCKED_APPS = [
  'Terminal',
  'iTerm2',
  'Warp',
  'Alacritty',
  'WindowsTerminal',
  'cmd.exe',
  'powershell.exe'
];

export const FREE_DEVICE_DAILY_LIMIT = 10;
export const AUTHENTICATED_DAILY_LIMIT = 100;

const CODE_PATTERNS = [
  /(^|\n)\s*(import|export|const|let|var|function|def|class|fn|pub fn|return|package|namespace)\b/,
  /(^|\n)\s*(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/i,
  /<\/?([a-zA-Z0-9_-]+)(\s+[^>]*)?>/,
  /console\.(log|error|warn|info)|print\(|System\.out\.println/,
  /^[\[\{][\s\S]*[\]\}]$/,
  /\b(my_[a-z0-9_]+|[a-z0-9]+_[a-z0-9_]+)\b/
];

/**
 * Smart heuristic filter to avoid intrusive "Clippy" popups on non-text selections:
 * - Rejects pure numbers, currency, timestamps, and punctuation.
 * - Rejects obvious code blocks and syntax tokens.
 * - Allows natural sentences or double-clicked single words (>= 3 alpha letters).
 */
export function isTextEligibleForCheck(
  rawText: string,
  options: { skipCodeAndNumbers?: boolean } = { skipCodeAndNumbers: true }
): boolean {
  if (!rawText) return false;
  const trimmed = rawText.trim();
  if (trimmed.length < 2 || trimmed.length > 2000) {
    return false;
  }

  if (!options.skipCodeAndNumbers) {
    return true;
  }

  // Must contain at least one alphabetic character
  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) {
    return false;
  }

  // Reject if purely numbers/punctuation/symbols with no word context (e.g. "$45.00", "2026-11-19")
  const strippedOfPunctuation = trimmed.replace(/[\d\s.,$€£¥\-–—/\\:;()[\]{}<>_+=*&^%#@!?"'~`|]/g, '');
  if (strippedOfPunctuation.length === 0) {
    return false;
  }

  // Single-word check: if there are no spaces, check if it looks like a variable name or identifier
  const hasWhitespace = /\s/.test(trimmed);
  if (!hasWhitespace) {
    if (trimmed.length < 3) return false;
    // Reject identifiers with underscores or camelCase like fooBarBaz or my_var
    if (trimmed.includes('_') || /^[a-z]+[A-Z]/.test(trimmed)) {
      return false;
    }
  }

  // Check code patterns
  for (const pattern of CODE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  return true;
}
