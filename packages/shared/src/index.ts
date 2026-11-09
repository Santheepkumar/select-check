export type SuggestionStyle =
  | 'grammar_fix'
  | 'clear_concise'
  | 'professional_polished';

export interface SuggestionItem {
  style: SuggestionStyle;
  label: string;
  text: string;
  summary: string;
}

export interface QuotaInfo {
  used: number;
  limit: number;
  tier: 'free_device' | 'authenticated';
  resetsAt: string;
}

export interface CheckRequest {
  text: string;
  deviceId: string;
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
}

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
