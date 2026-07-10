/**
 * @fileoverview Unit tests for the emit-console client-side Zod mirror.
 * @layer test
 */

import { describe, expect, it } from 'vitest';

import { emitFormSchema, parseEmitPayload } from './emit-schema';

describe('emitFormSchema', () => {
  it('accepts a non-empty, non-reserved event name', () => {
    // Scenario: a normal application event name passes validation.
    const result = emitFormSchema.safeParse({ event: 'incident.updated', dataText: '{}' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty event name', () => {
    // Scenario: the operator submits the form without typing an event name.
    const result = emitFormSchema.safeParse({ event: '', dataText: '{}' });
    expect(result.success).toBe(false);
  });

  it('rejects a library-reserved event name', () => {
    // Scenario: an operator tries to spoof the reserved connection:established event.
    const result = emitFormSchema.safeParse({ event: 'connection:established', dataText: '{}' });
    expect(result.success).toBe(false);
  });
});

describe('parseEmitPayload', () => {
  it('parses valid JSON', () => {
    // Scenario: the textarea holds a well-formed JSON object.
    expect(parseEmitPayload('{"a":1}')).toEqual({ a: 1 });
  });

  it('falls back to the raw trimmed string when JSON parsing fails', () => {
    // Scenario: an operator types free text instead of JSON.
    expect(parseEmitPayload('  hello  ')).toBe('hello');
  });

  it('returns an empty object for blank input', () => {
    // Scenario: the payload textarea was cleared entirely.
    expect(parseEmitPayload('   ')).toEqual({});
  });
});
