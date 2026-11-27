import { POST_STATUSES } from '@vp/domain';
import { z } from 'zod';

/** `status` narrows the list to one stage; absent, and any value that is not a stage, lists every post. */
export const PostsSearchSchema = z.object({
  status: z
    .unknown()
    .optional()
    .transform((status) => POST_STATUSES.find((known) => known === status)),
});
