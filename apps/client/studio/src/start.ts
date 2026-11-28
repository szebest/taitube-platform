import { clientAppRequestMiddleware } from '@kit/security-headers';
import { createStart } from '@tanstack/react-start';
import { sessionMiddleware } from '@vp/queries';
import { studioComposition } from '#app/composition/registry';

export const startInstance = createStart(() => ({
  requestMiddleware: [...clientAppRequestMiddleware, sessionMiddleware(studioComposition.session)],
}));
