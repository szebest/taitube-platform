import { z } from 'zod';

export const InvitesSearchSchema = z.object({
  invite: z
    .unknown()
    .optional()
    .transform((invite) => (z.uuid().safeParse(invite).success ? String(invite) : undefined)),
});
