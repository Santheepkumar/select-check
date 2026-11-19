import { DEFAULT_APP_SETTINGS, type AppSettings } from '@select-check/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkGrammarWithApi, testProviderConnection } from '../src/services/api.js';

describe('Desktop Direct Provider & API Service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('routes to direct provider when providerType is byok_groq', async () => {
    const mockResponsePayload = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              detectedLanguage: 'EN',
              grammarFix: { text: 'He and I went to the store.', summary: 'Fixed pronouns & verb tense' },
              clearConcise: { text: 'We went to the store.', summary: 'Concise phrasing' },
              slotThree: { text: 'Hey! We went to the store :)', summary: 'Friendly tone' }
            })
          }
        }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponsePayload
    } as unknown as Response);

    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      providerType: 'byok_groq',
      customApiKey: 'gsk_test123',
      slot3Preset: 'casual_friendly'
    };

    const res = await checkGrammarWithApi('me and him goes to store', settings);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer gsk_test123'
        })
      })
    );

    expect(res.suggestions).toHaveLength(3);
    expect(res.suggestions[0].style).toBe('grammar_fix');
    expect(res.suggestions[2].style).toBe('casual_friendly');
    expect(res.quota.tier).toBe('unlimited_byok');
  });

  it('handles local ollama endpoint without requiring an api key', async () => {
    const mockResponsePayload = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              detectedLanguage: 'EN',
              grammarFix: { text: 'Clean text.', summary: 'Grammar ok' },
              clearConcise: { text: 'Clean text.', summary: 'Concise ok' },
              slotThree: { text: '• Point 1', summary: 'Bullets' }
            })
          }
        }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponsePayload
    } as unknown as Response);

    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      providerType: 'local_ollama',
      customBaseUrl: 'http://localhost:11434/v1',
      slot3Preset: 'bullet_points'
    };

    const res = await checkGrammarWithApi('clean text', settings);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.anything()
    );
    expect(res.suggestions[2].style).toBe('bullet_points');
    expect(res.quota.tier).toBe('unlimited_byok');
  });

  it('measures connection latency in testProviderConnection', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({})
    } as unknown as Response);

    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      providerType: 'byok_openai',
      customApiKey: 'sk-test'
    };

    const status = await testProviderConnection(settings);
    expect(status.ok).toBe(true);
    expect(status.message).toContain('Connected to gpt-4o-mini');
  });
});
