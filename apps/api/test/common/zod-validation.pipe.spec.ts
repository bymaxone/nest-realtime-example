/**
 * Unit tests for ZodValidationPipe.
 *
 * Layer: unit.
 * Goal: valid payloads pass through typed; invalid ones raise a sanitized 400.
 * Mocks: none.
 */

import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '../../src/common/zod-validation.pipe';

const schema = z.object({ username: z.string().min(1) });

describe('ZodValidationPipe', () => {
  /**
   * Valid payload.
   *
   * A conforming body must be returned narrowed to the schema's output type.
   */
  it('returns the parsed value for a valid payload', () => {
    const pipe = new ZodValidationPipe(schema);

    expect(pipe.transform({ username: 'ana@acme' })).toEqual({ username: 'ana@acme' });
  });

  /**
   * Invalid payload.
   *
   * A non-conforming body must raise a 400 whose detail names the field path and
   * code without echoing the received value.
   */
  it('throws a sanitized BadRequestException for an invalid payload', () => {
    const pipe = new ZodValidationPipe(schema);

    expect(() => pipe.transform({ username: '' })).toThrow(BadRequestException);
    try {
      pipe.transform({});
    } catch (error) {
      const response = (error as BadRequestException).getResponse();
      expect(response).toMatchObject({ message: 'Invalid request body' });
      expect(JSON.stringify(response)).toContain('username');
    }
  });
});
