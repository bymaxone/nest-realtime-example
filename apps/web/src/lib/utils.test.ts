/**
 * @fileoverview Unit tests for the `cn` Tailwind class-merge utility.
 * @layer test
 */

import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('joins plain string class names', () => {
    // Scenario: two static class strings are merged with a single space.
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    // Scenario: conditional classes (false/undefined/null) are omitted entirely.
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('resolves conflicting Tailwind utilities to the last one', () => {
    // Scenario: tailwind-merge keeps only the last conflicting padding utility.
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
