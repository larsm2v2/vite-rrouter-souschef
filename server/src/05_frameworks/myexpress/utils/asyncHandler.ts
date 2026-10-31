import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async Express route handler so that a rejected promise (e.g. a
 * thrown error from an awaited use-case/DB call) is forwarded to `next(err)`
 * instead of becoming an unhandled promise rejection.
 *
 * Express 4 does not catch async errors automatically -- a handler that
 * `await`s something which throws, without its own try/catch, will hang the
 * request and can crash the whole process under strict unhandled-rejection
 * settings. Wrap any async handler that doesn't already have its own
 * try/catch + next(err) with this helper.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
