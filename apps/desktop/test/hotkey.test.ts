import { DEFAULT_APP_SETTINGS } from '@select-check/shared';
import { describe, expect, it } from 'vitest';
import { formatShortcutForDisplay } from '../src/components/ShortcutRecorder.js';

describe('Hotkey & Onboarding Settings', () => {
  it('defaults to hotkey_only triggerMode with autoShowOnSelect disabled', () => {
    expect(DEFAULT_APP_SETTINGS.triggerMode).toBe('hotkey_only');
    expect(DEFAULT_APP_SETTINGS.autoShowOnSelect).toBe(false);
    expect(DEFAULT_APP_SETTINGS.globalShortcut).toBe('CommandOrControl+Shift+G');
    expect(DEFAULT_APP_SETTINGS.onboardingCompleted).toBe(false);
  });

  it('formats accelerator tokens correctly for UI display', () => {
    const tokens = formatShortcutForDisplay('CommandOrControl+Shift+G');
    expect(tokens.length).toBe(3);
    expect(tokens[tokens.length - 1]).toBe('G');

    const singleKey = formatShortcutForDisplay('Space');
    expect(singleKey).toEqual(['Space']);

    const empty = formatShortcutForDisplay('');
    expect(empty).toEqual(['None']);
  });
});
