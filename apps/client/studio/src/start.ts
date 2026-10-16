import { createStart } from '@tanstack/react-start';
import { apiProxyMiddleware } from '@vp/queries';
import { clientAppRequestMiddleware } from '@vp/security-headers';

import { API_BASE_URL } from './config';

export const startInstance = createStart(() => ({
  requestMiddleware: [...clientAppRequestMiddleware, apiProxyMiddleware(API_BASE_URL)],
}));
