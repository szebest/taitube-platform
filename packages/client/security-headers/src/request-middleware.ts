import { createCsrfMiddleware } from '@tanstack/react-start';

import { securityHeadersMiddleware } from './security-headers';

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
