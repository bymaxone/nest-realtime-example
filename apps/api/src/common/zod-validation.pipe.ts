/**
 * @fileoverview NestJS pipe that validates request payloads with a Zod schema.
 * @layer common
 *
 * Keeps controllers thin: they declare the schema, the pipe parses and narrows
 * the body to its inferred type or rejects with a 400 whose detail lists only the
 * offending field paths and codes, never the received values.
 */

import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Validates and narrows an unknown payload against a Zod schema. */
@Injectable()
export class ZodValidationPipe<TOutput> implements PipeTransform<unknown, TOutput> {
  /**
   * Build the pipe for a specific schema.
   *
   * @param schema - The Zod schema the payload must satisfy.
   */
  constructor(private readonly schema: ZodType<TOutput>) {}

  /**
   * Parse and narrow the value, or throw a 400 with sanitized issue detail.
   *
   * @param value - The raw, untrusted payload.
   * @returns The validated value typed as `TOutput`.
   * @throws BadRequestException when the payload fails validation.
   */
  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new BadRequestException({
      message: 'Invalid request body',
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
      })),
    });
  }
}
