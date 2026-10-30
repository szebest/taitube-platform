import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { CustomizationPage } from '#app/features/channel/components/customization-page';

export const Route = createFileRoute('/_authed/customization')({
  staticData: { layoutMaxWidth: '960px' },
  validateSearch: z.object({}),
  component: CustomizationPage,
});
