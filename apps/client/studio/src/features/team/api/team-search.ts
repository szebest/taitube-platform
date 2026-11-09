import { CHANNEL_AUDIT_ACTIONS } from '@vp/domain';
import { z } from 'zod';
import { AccessDeniedSearchSchema } from '#app/features/shell/utils/access-denied-search';

export const TeamSearchSchema = AccessDeniedSearchSchema.extend({
  tab: z
    .unknown()
    .optional()
    .transform((tab) => (tab === 'audit' ? 'audit' : 'members')),
  actor: z
    .unknown()
    .optional()
    .transform((actor) => (z.uuid().safeParse(actor).success ? String(actor) : undefined)),
  action: z
    .unknown()
    .optional()
    .transform((action) => CHANNEL_AUDIT_ACTIONS.find((known) => known === action)),
});
