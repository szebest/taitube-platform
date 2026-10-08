import { createFileRoute, lazyRouteComponent, notFound } from '@tanstack/react-router';
import { z } from 'zod';

import { DEVTOOLS_ENABLED } from '#app/config';

export const Route = createFileRoute('/design-system')({
  validateSearch: z.object({}),
  beforeLoad: () => {
    if (!DEVTOOLS_ENABLED) throw notFound();
  },
  head: () => ({ meta: [{ title: 'Design system - Taitube' }] }),
  component: DEVTOOLS_ENABLED
    ? lazyRouteComponent(() => import('#app/features/design-system/showcase'), 'Showcase')
    : () => null,
});
