import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { AllVideosPage } from 'src/modules/AllVideosPage';

export const Route = createFileRoute('/')({
  validateSearch: z.object({}),
  component: AllVideosPage,
});
