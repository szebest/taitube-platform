import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start';

import { withSecurityHeaders } from './integrations/security/security-headers';

const serverFunctionCsrf = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
});

const securityHeaders = createMiddleware().server(({ next }) =>
  withSecurityHeaders(async (nonce) => next({ context: { nonce } }))
);

export const startInstance = createStart(() => ({
  requestMiddleware: [serverFunctionCsrf, securityHeaders],
}));
