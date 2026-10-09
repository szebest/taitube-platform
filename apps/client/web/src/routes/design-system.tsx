import { createFileRoute, notFound } from '@tanstack/react-router';
import { lazy } from 'react';
import { z } from 'zod';

// A static import ships the showcase: its top-level tv() calls stop Rolldown dropping it.
const Showcase = import.meta.env.DEV
  ? lazy(() =>
      import('#app/features/design-system/showcase').then((module) => ({
        default: module.Showcase,
      }))
    )
  : () => null;

export const Route = createFileRoute('/design-system')({
  validateSearch: z.object({}),
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  head: () => ({ meta: [{ title: 'Design system - Taitube' }] }),
  component: Showcase,
});
