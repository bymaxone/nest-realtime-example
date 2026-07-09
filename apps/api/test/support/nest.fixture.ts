/**
 * @fileoverview Lightweight NestJS/Express test doubles.
 * @layer test-support
 *
 * The framework request, response and execution-context interfaces are large;
 * these helpers build minimal doubles exposing only the members the units under
 * test touch. Each cast is a deliberate partial double, not a laundered error.
 */

import type { ExecutionContext } from '@nestjs/common';
import type { Response } from 'express';

import type { RequestWithSession } from '../../src/auth/session.types';

/** Records the arguments a `res.cookie`/`res.clearCookie` call received. */
export interface ResponseDouble {
  readonly res: Response;
  readonly cookie: jest.Mock;
  readonly clearCookie: jest.Mock;
}

/**
 * Build an Express response double capturing cookie mutations.
 *
 * @returns The double and its cookie spies.
 */
export function mockResponse(): ResponseDouble {
  const cookie = jest.fn();
  const clearCookie = jest.fn();
  const res = { cookie, clearCookie } as unknown as Response;
  return { res, cookie, clearCookie };
}

/**
 * Build an execution context whose HTTP request is the given object.
 *
 * @param request - The request the context should expose.
 * @returns An execution-context double.
 */
export function mockHttpContext(request: Partial<RequestWithSession>): ExecutionContext {
  const httpArgumentsHost = {
    getRequest: () => request,
    getResponse: () => ({}),
    getNext: () => ({}),
  };
  return { switchToHttp: () => httpArgumentsHost } as unknown as ExecutionContext;
}
