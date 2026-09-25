import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { TrendingPage } from 'src/modules/Trending';

export const Route = createFileRoute('/trending')({
  validateSearch: z.object({}),
  component: TrendingPage,
});
