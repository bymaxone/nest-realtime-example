/**
 * @fileoverview Zod schema and type for the emit console request body.
 * @layer emit
 *
 * The event name must be non-empty and must not be one the library reserves, so
 * the console can never spoof a `connection:established` or other reserved event.
 */

import { z } from 'zod';

import { isReservedEventName } from '../../common/reserved-events';

/** Schema for the emit endpoints: an allowed event name and a free-form payload. */
export const emitSchema = z.object({
  event: z
    .string()
    .min(1)
    .refine((name) => !isReservedEventName(name), {
      message: 'event name is reserved by the library',
    }),
  data: z.unknown(),
});

/** Validated emit request body. */
export type EmitDto = z.infer<typeof emitSchema>;
