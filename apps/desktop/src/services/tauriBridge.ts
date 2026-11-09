import { DEFAULT_BLOCKED_APPS, type AppSettings } from '@select-check/shared';

const STORAGE_KEY = 'select_check_settings_v1';

export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem('select_check_device_id');
  if (existing) return existing;
  const created = `dev_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  localStorage.setItem('select_check_device_id', created);
  return created;
}

export function loadLocalSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...getDefaultSettings(), ...JSON.parse(raw) };
    }
  } catch {
    // ignore storage errors
  }
  return getDefaultSettings();
}

export function getDefaultSettings(): AppSettings {
  return {
    autoShowOnSelect: true,
    autoHideSeconds: 4,
    showWordDiff: true,
    globalShortcut: 'CommandOrControl+Shift+G',
    blockedApps: [...DEFAULT_BLOCKED_APPS],
    apiUrl: 'http://localhost:8787',
    deviceId: getOrCreateDeviceId()
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const local = loadLocalSettings();
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const rustSettings = await invoke<AppSettings>('get_settings');
      return { ...rustSettings, ...local };
    } catch {
      return local;
    }
  }
  return local;
}

export async function saveAppSettings(next: AppSettings): Promise<AppSettings> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_settings', { settings: next });
    } catch {
      // ignore if command unavailable
    }
  }
  return next;
}

export async function expandNativeOverlay(): Promise<void> {
  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('expand_overlay');
  }
}

export async function dismissNativeOverlay(): Promise<void> {
  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('dismiss_overlay');
  }
}

export async function openNativeSettingsWindow(): Promise<void> {
  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_settings_window');
  }
}

export async function replaceSelectedTextInPlace(text: string): Promise<void> {
  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('replace_selected_text', { text });
  }
}
