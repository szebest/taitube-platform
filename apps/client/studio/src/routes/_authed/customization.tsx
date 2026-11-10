import { createFileRoute } from '@tanstack/react-router';
import { prefetched } from '@vp/queries';
import { z } from 'zod';
import {
  CustomizationPage,
  CustomizationPageSkeleton,
  prefetchCustomization,
} from '#app/features/channel';

export const Route = createFileRoute('/_authed/customization')({
  staticData: { layoutMaxWidth: '960px' },
  validateSearch: z.object({}),
  loader: ({ context }) => prefetched(prefetchCustomization(context)),
  pendingComponent: CustomizationPageSkeleton,
  component: CustomizationPage,
});
