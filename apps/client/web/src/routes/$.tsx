import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

const SECTION_FALLBACKS = [
  { section: 'trending', to: '/feed/trending' },
  { section: 'subscriptions', to: '/subscriptions/videos' },
  { section: 'upload', to: '/upload' },
] as const;

function fallbackFor(unmatched: string) {
  const fallback = SECTION_FALLBACKS.find(
    ({ section }) => unmatched === section || unmatched.startsWith(`${section}/`)
  );
  return fallback?.to ?? '/';
}

export const Route = createFileRoute('/$')({
  validateSearch: z.object({}),
  beforeLoad: ({ params }) => {
    throw redirect({ to: fallbackFor(params._splat ?? ''), replace: true });
  },
});
