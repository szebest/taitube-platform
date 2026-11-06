import { z } from 'zod';

/** What a redirect out of `beforeLoad` carries to the page it lands on, which shows it once. */
export const AccessDeniedSearchSchema = z.object({
  denied: z.literal('admin').optional(),
});
