import { describe, it, expect, beforeEach } from 'vitest';
import { computeWordDiff } from '../src/utils/diff.js';
import {
  addHistoryEntry,
  loadHistory,
  toggleFavoriteEntry,
  deleteHistoryEntry,
  clearAllHistory
} from '../src/services/localHistoryDb.js';
import { isTextEligibleForCheck, type CheckResponse } from '@select-check/shared';

// Polyfill localStorage for node test environment
if (typeof globalThis.localStorage === 'undefined') {
  let store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] || null,
    get length() {
      return Object.keys(store).length;
    }
  };
}

describe('SelectCheck Mobile Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Word Diff Engine', () => {
    it('accurately detects word insertions and deletions', () => {
      const orig = 'Hey r u comming to the meating?';
      const rev = 'Hey, are you coming to the meeting?';
      const diff = computeWordDiff(orig, rev);

      expect(diff.length).toBeGreaterThan(0);
      const hasInsert = diff.some((s) => s.type === 'insert');
      const hasDelete = diff.some((s) => s.type === 'delete');
      expect(hasInsert).toBe(true);
      expect(hasDelete).toBe(true);
    });

    it('returns single equal segment when texts match', () => {
      const text = 'Perfect sentence already.';
      const diff = computeWordDiff(text, text);
      expect(diff).toEqual([{ type: 'equal', value: text }]);
    });
  });

  describe('Local Persistent History', () => {
    const mockCheckResponse: CheckResponse = {
      originalText: 'can u check this pls',
      detectedLanguage: 'EN',
      suggestions: [
        {
          style: 'grammar_fix',
          label: 'Grammar Fix',
          text: 'Can you check this please?',
          summary: 'Capitalized and expanded'
        },
        {
          style: 'clear_concise',
          label: 'Clear & Concise',
          text: 'Could you review this?',
          summary: 'Crisp review request'
        },
        {
          style: 'professional_polished',
          label: 'Professional & Polished',
          text: 'Kindly review this at your earliest convenience.',
          summary: 'Workplace polite'
        }
      ],
      quota: {
        used: 1,
        limit: 10,
        tier: 'free_device',
        resetsAt: new Date().toISOString()
      }
    };

    it('saves and loads history entries', () => {
      expect(loadHistory()).toHaveLength(0);
      const entry = addHistoryEntry(mockCheckResponse);
      expect(entry.id).toBeDefined();

      const loaded = loadHistory();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].originalText).toBe('can u check this pls');
      expect(loaded[0].suggestions[0].text).toBe('Can you check this please?');
    });

    it('toggles favorite star on history items', () => {
      const entry = addHistoryEntry(mockCheckResponse);
      expect(entry.isFavorite).toBe(false);

      const afterStar = toggleFavoriteEntry(entry.id);
      expect(afterStar[0].isFavorite).toBe(true);

      const afterUnstar = toggleFavoriteEntry(entry.id);
      expect(afterUnstar[0].isFavorite).toBe(false);
    });

    it('deletes history items and clears all', () => {
      const entry = addHistoryEntry(mockCheckResponse);
      expect(loadHistory()).toHaveLength(1);

      const afterDelete = deleteHistoryEntry(entry.id);
      expect(afterDelete).toHaveLength(0);

      addHistoryEntry(mockCheckResponse);
      addHistoryEntry(mockCheckResponse);
      expect(loadHistory()).toHaveLength(2);

      clearAllHistory();
      expect(loadHistory()).toHaveLength(0);
    });
  });

  describe('Text Eligibility Heuristics', () => {
    it('accepts typical WhatsApp messages', () => {
      expect(isTextEligibleForCheck('Hey how are you doing?')).toBe(true);
      expect(isTextEligibleForCheck('will send the document by 5pm')).toBe(true);
    });

    it('rejects code snippets and syntax from popup triggers', () => {
      expect(isTextEligibleForCheck('const x = 42;')).toBe(false);
      expect(isTextEligibleForCheck('SELECT * FROM users;')).toBe(false);
      expect(isTextEligibleForCheck('import React from "react";')).toBe(false);
    });

    it('rejects pure numbers and currency', () => {
      expect(isTextEligibleForCheck('$150.00')).toBe(false);
      expect(isTextEligibleForCheck('123456')).toBe(false);
    });
  });
});
