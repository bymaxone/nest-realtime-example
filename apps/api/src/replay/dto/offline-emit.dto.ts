/**
 * @fileoverview Zod schema and type for the offline lab emit request body.
 * @layer replay
 *
 * Emits `count` numbered events to a named user who must currently have no live
 * connection; the count is bounded to keep a queue from growing unboundedly.
 */

import { z } from 'zod';

/** Largest offline emit a single lab request may enqueue. */
const MAX_OFFLINE_BURST = 100;

/** Schema for `POST /labs/offline/emit`: the target user and how many events. */
export const offlineEmitSchema = z.object({
  userId: z.string().min(1),
  count: z.number().int().min(1).max(MAX_OFFLINE_BURST),
});

/** Validated offline emit request body. */
export type OfflineEmitDto = z.infer<typeof offlineEmitSchema>;
