import { CREATOR_INBOX_FILTERS } from '@vp/domain';
import { z } from 'zod';
import { AccessDeniedSearchSchema } from '#app/features/shell/access-denied-search';

export const InboxSearchSchema = AccessDeniedSearchSchema.extend({
  filter: z
    .unknown()
    .optional()
    .transform((filter) => CREATOR_INBOX_FILTERS.find((known) => known === filter) ?? 'all'),
});
