import { createFileRoute } from '@tanstack/react-router';
import { prefetched } from '@vp/queries';
import { z } from 'zod';
import { PageBuilderPage, prefetchPageBuilder } from '#app/features/page-builder';

export const Route = createFileRoute('/_authed/customization_/page')({
  staticData: { layoutMaxWidth: '1200px' },
  validateSearch: z.object({}),
  loader: ({ context }) => prefetched(prefetchPageBuilder(context)),
  component: PageBuilderPage,
});
