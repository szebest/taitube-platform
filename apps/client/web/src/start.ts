import { createStart } from '@tanstack/react-start';
import { clientAppRequestMiddleware } from '@vp/security-headers';

export const startInstance = createStart(() => ({
  requestMiddleware: clientAppRequestMiddleware,
}));
