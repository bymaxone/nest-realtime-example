/**
 * @fileoverview Unit tests for the {@link ApiError} type.
 * @layer test
 */

import { describe, expect, it } from 'vitest';

import { ApiError } from './api-error';

describe('ApiError', () => {
  it('carries the status, message, and defaults issues to an empty array', () => {
    // Scenario: constructing without issues yields a well-formed error instance.
    const err = new ApiError(403, 'cross-tenant emit denied');
    expect(err.status).toBe(403);
    expect(err.message).toBe('cross-tenant emit denied');
    expect(err.issues).toEqual([]);
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(Error);
  });

  it('carries field-level issues when provided', () => {
    // Scenario: a 400 from the Zod validation pipe includes per-field issues.
    const err = new ApiError(400, 'Invalid request body', [{ path: 'event', code: 'too_small' }]);
    expect(err.issues).toEqual([{ path: 'event', code: 'too_small' }]);
  });
});
