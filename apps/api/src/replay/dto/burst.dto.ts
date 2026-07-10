/**
 * @fileoverview Zod schema and type for the replay lab burst request body.
 * @layer replay
 *
 * A burst emits `count` numbered events; the count is bounded so a lab request
 * can never enqueue an unbounded number of events.
 */

import { z } from 'zod';

/** Largest burst a single lab request may emit. */
const MAX_BURST = 100;

/** Schema for `POST /labs/replay/emit-burst`: how many numbered events to emit. */
export const burstSchema = z.object({
  count: z.number().int().min(1).max(MAX_BURST),
});

/** Validated replay burst request body. */
export type BurstDto = z.infer<typeof burstSchema>;
