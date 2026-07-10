/**
 * @fileoverview Typed error thrown by every failed api-client call.
 * @layer lib
 */

/** One field-level validation issue, as returned by the api's Zod validation pipe. */
export interface ApiIssue {
  readonly path: string;
  readonly code: string;
}

/**
 * Error raised when the api responds with a non-2xx status. Carries the HTTP
 * status and, when the api returned a structured body (validation failure,
 * forbidden envelope, ...), its message and field issues.
 */
export class ApiError extends Error {
  /** The HTTP status code of the failed response. */
  readonly status: number;
  /** Field-level validation issues, present only on a 400 from the Zod pipe. */
  readonly issues: readonly ApiIssue[];

  /**
   * Build an api error from a failed response.
   *
   * @param status - The HTTP status code.
   * @param message - The api-provided or fallback error message.
   * @param issues - Field-level validation issues, when present.
   */
  constructor(status: number, message: string, issues: readonly ApiIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }
}
