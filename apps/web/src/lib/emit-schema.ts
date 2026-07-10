/**
 * @fileoverview Client-side mirror of the api's emit-console Zod schema.
 * @layer lib
 *
 * Mirrors `apps/api/src/emit/dto/emit.dto.ts`: the event name must be non-empty
 * and must not collide with a library-reserved name, so the broadcast console
 * never lets an operator try to spoof `connection:established` or similar. The
 * api re-validates independently; this mirror only gives immediate client-side
 * feedback before a round trip.
 */

import { RESERVED_EVENT_NAMES } from '@bymax-one/nest-realtime/shared';
import { z } from 'zod';

const RESERVED_NAME_SET = new Set<string>(Object.values(RESERVED_EVENT_NAMES));

/** Client-side mirror of the api's emit request body schema. */
export const emitFormSchema = z.object({
  event: z
    .string()
    .min(1, 'event name is required')
    .refine((name) => !RESERVED_NAME_SET.has(name), 'event name is reserved by the library'),
  dataText: z.string(),
});

/** Validated emit form input, before the free-form JSON payload is parsed. */
export type EmitFormInput = z.infer<typeof emitFormSchema>;

/**
 * Parse the free-form payload textarea as JSON, falling back to a plain string.
 *
 * An operator experimenting in the console should never be blocked by invalid
 * JSON; a bare string is a legitimate event payload too.
 *
 * @param dataText - The raw textarea contents.
 * @returns The parsed JSON value, or the original string when parsing fails.
 */
export function parseEmitPayload(dataText: string): unknown {
  const trimmed = dataText.trim();
  if (trimmed.length === 0) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}
