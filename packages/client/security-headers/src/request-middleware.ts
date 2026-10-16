import { createCsrfMiddleware } from '@tanstack/react-start';

import { securityHeadersMiddleware } from './security-headers';

/** Refuses a cross-site call to a server function; page requests are not its concern. */
const serverFunctionCsrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
});

/** What every client app's `src/start.ts` hands `createStart` as its `requestMiddleware`. */
export const clientAppRequestMiddleware = [serverFunctionCsrfMiddleware, securityHeadersMiddleware];
