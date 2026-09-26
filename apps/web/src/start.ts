import { createCsrfMiddleware, createStart } from '@tanstack/react-start';

import { securityHeadersMiddleware } from './integrations/security/security-headers';

const serverFunctionCsrf = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
});

export const startInstance = createStart(() => ({
  requestMiddleware: [serverFunctionCsrf, securityHeadersMiddleware],
}));
