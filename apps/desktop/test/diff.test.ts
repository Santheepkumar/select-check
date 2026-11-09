import { describe, expect, it } from 'vitest';
import { computeWordDiff } from '../src/utils/diff.js';

describe('computeWordDiff', () => {
  it('returns a single equal segment when texts are identical', () => {
    const diff = computeWordDiff('Hello world.', 'Hello world.');
    expect(diff).toEqual([{ type: 'equal', value: 'Hello world.' }]);
  });

  it('highlights deleted and inserted words accurately', () => {
    const original = 'me and him goes to the store';
    const revised = 'He and I went to the store.';
    const diff = computeWordDiff(original, revised);

    const hasDelete = diff.some((s) => s.type === 'delete' && s.value.includes('me'));
    const hasInsert = diff.some((s) => s.type === 'insert' && s.value.includes('He'));
    const hasCommon = diff.some((s) => s.type === 'equal' && s.value.includes('to the'));

    expect(hasDelete).toBe(true);
    expect(hasInsert).toBe(true);
    expect(hasCommon).toBe(true);
  });
});
