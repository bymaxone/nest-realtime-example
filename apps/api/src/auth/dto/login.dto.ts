/**
 * @fileoverview Zod schema and type for the login request body.
 * @layer auth
 */

import { z } from 'zod';

/** Schema for `POST /auth/login`: a non-empty demo username. */
export const loginSchema = z.object({
  username: z.string().min(1),
});

/** Validated login request body. */
export type LoginDto = z.infer<typeof loginSchema>;
