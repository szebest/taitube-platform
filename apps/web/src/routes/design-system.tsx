import { createFileRoute, notFound } from '@tanstack/react-router';
import { lazy } from 'react';
import { z } from 'zod';

import { DEVTOOLS_ENABLED } from '#app/config';

// A static import ships the showcase: its top-level tv() calls stop Rollup dropping it.
const Showcase = DEVTOOLS_ENABLED
  ? lazy(() =>
      import('#app/features/design-system/showcase').then((module) => ({
        default: module.Showcase,
      }))
    )
  : () => null;

export const Route = createFileRoute('/design-system')({
  validateSearch: z.object({}),
  beforeLoad: () => {
    if (!DEVTOOLS_ENABLED) throw notFound();
  },
  head: () => ({ meta: [{ title: 'Design system - Taitube' }] }),
  component: Showcase,
});
