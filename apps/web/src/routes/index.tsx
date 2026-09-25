import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { AllVideosPage } from '#app/modules/AllVideosPage';

export const Route = createFileRoute('/')({
  validateSearch: z.object({}),
  component: AllVideosPage,
});
