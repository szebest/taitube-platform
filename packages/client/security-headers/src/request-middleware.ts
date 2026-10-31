import { createCsrfMiddleware } from '@tanstack/react-start';

import {
  createSecurityHeadersMiddleware,
  type SecurityHeadersOptions,
  securityHeadersMiddleware,
} from './security-headers';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/**
 * Refuses a cross-site call to a server function, or any request that could change something (the
 * app's `/api` proxy writes with the viewer's credentials); a page is a GET and is not its concern.
 */
const crossSiteWriteMiddleware = createCsrfMiddleware({
  filter: ({ handlerType, request }) =>
    handlerType === 'serverFn' || !SAFE_METHODS.has(request.method),
});

/** What every client app's `src/start.ts` hands `createStart` as its `requestMiddleware`. */
export const clientAppRequestMiddleware = [crossSiteWriteMiddleware, securityHeadersMiddleware];

/** The same list for an app with a path other sites may frame: the embed route of the viewer app. */
export function clientAppRequestMiddlewareFor(options: SecurityHeadersOptions) {
  return [crossSiteWriteMiddleware, createSecurityHeadersMiddleware(options)];
}
