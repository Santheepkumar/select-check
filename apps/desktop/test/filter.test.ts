import { isTextEligibleForCheck } from '@select-check/shared';
import { describe, expect, it } from 'vitest';

describe('isTextEligibleForCheck', () => {
  it('accepts regular sentences and writing', () => {
    expect(isTextEligibleForCheck('Hello, this is a test email message.')).toBe(true);
    expect(isTextEligibleForCheck('me and him goes to the store')).toBe(true);
    expect(isTextEligibleForCheck('grammar')).toBe(true);
    expect(isTextEligibleForCheck('Bonjour à tous')).toBe(true);
  });

  it('rejects pure numbers, dates, and currency', () => {
    expect(isTextEligibleForCheck('123456')).toBe(false);
    expect(isTextEligibleForCheck('$49.99')).toBe(false);
    expect(isTextEligibleForCheck('2026-11-19')).toBe(false);
    expect(isTextEligibleForCheck('100%')).toBe(false);
    expect(isTextEligibleForCheck('---')).toBe(false);
  });

  it('rejects code patterns when skipCodeAndNumbers is true', () => {
    expect(isTextEligibleForCheck('const myVar = 10;')).toBe(false);
    expect(isTextEligibleForCheck('import React from "react";')).toBe(false);
    expect(isTextEligibleForCheck('def calculate_sum(a, b):')).toBe(false);
    expect(isTextEligibleForCheck('console.log("hello");')).toBe(false);
    expect(isTextEligibleForCheck('<div className="box"></div>')).toBe(false);
    expect(isTextEligibleForCheck('SELECT * FROM users WHERE id = 1')).toBe(false);
    expect(isTextEligibleForCheck('camelCaseVar')).toBe(false);
    expect(isTextEligibleForCheck('user_account_id')).toBe(false);
  });

  it('respects skipCodeAndNumbers = false when disabled', () => {
    expect(
      isTextEligibleForCheck('const myVar = 10;', { skipCodeAndNumbers: false })
    ).toBe(true);
  });
});
