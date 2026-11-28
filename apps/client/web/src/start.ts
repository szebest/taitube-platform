import { clientAppRequestMiddlewareFor } from '@kit/security-headers';
import { createStart } from '@tanstack/react-start';
import { sessionMiddleware } from '@vp/queries';
import { webComposition } from '#app/composition/registry';

export const startInstance = createStart(() => ({
  requestMiddleware: [
    ...clientAppRequestMiddlewareFor({ embeddablePrefix: webComposition.embeddablePrefix }),
    sessionMiddleware(webComposition.session),
  ],
}));
