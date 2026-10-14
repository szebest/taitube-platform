import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

const SECTION_FALLBACKS = [
  { section: 'trending/', to: '/trending' },
  { section: 'subscriptions/', to: '/subscriptions/videos' },
  { section: 'upload/', to: '/upload' },
] as const;

function fallbackFor(unmatched: string) {
  return SECTION_FALLBACKS.find(({ section }) => unmatched.startsWith(section))?.to ?? '/';
}

export const Route = createFileRoute('/$')({
  validateSearch: z.object({}),
  beforeLoad: ({ params }) => {
    throw redirect({ to: fallbackFor(params._splat ?? ''), replace: true });
  },
});
