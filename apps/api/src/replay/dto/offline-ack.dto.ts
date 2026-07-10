/**
 * @fileoverview Zod schema and type for the offline lab acknowledge request body.
 * @layer replay
 *
 * Acknowledging purges every queued event up to and including `upToId`, the id of
 * the last event the caller confirms delivered.
 */

import { z } from 'zod';

/** Schema for `POST /labs/offline/ack`: the delivery watermark to purge up to. */
export const offlineAckSchema = z.object({
  upToId: z.string().min(1),
});

/** Validated offline acknowledge request body. */
export type OfflineAckDto = z.infer<typeof offlineAckSchema>;
