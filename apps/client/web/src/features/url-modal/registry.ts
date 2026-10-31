import { z } from 'zod';

import { createUrlModals } from './create-url-modals';

export const urlModals = createUrlModals({
  'clear-history': z.object({ scope: z.enum(['history', 'searches']) }),
});
