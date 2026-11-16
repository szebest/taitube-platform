import type { FastifyCorsOptions, FastifyCorsOptionsDelegatePromise } from '@fastify/cors';
import { carriesApiToken } from './bearer';

const CORS_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'];

/** Chromium caps a cached preflight at two hours, so a longer value buys nothing. */
const CORS_PREFLIGHT_MAX_AGE_SECONDS = 7200;

/**
 * The listed origins, for every request but one carrying a personal access token: a token does not
 * belong in a browser, so its responses carry no CORS headers and a page cannot read them.
 */
export function corsOptionsFor(origins: readonly string[]): FastifyCorsOptionsDelegatePromise {
  const listed: FastifyCorsOptions = {
    origin: [...origins],
    methods: CORS_METHODS,
    maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
  };
  return async (request) =>
    carriesApiToken(request.headers.authorization) ? { origin: false } : listed;
}
