import { z } from 'zod';
import { ACCOUNT_ACTIONS } from '#app/lib/account-action/account-actions';
import { createUrlModals } from './create-url-modals';

export const urlModals = createUrlModals({
  'clear-history': z.object({ scope: z.enum(['history', 'searches']) }),
  'save-to-playlist': z.object({ videoId: z.uuid() }),
  'new-playlist': z.object({}),
  'delete-playlist': z.object({ playlistId: z.uuid() }),
  'sign-in': z.object({
    reason: z.enum(ACCOUNT_ACTIONS),
    redirect: z.string().optional(),
    intent: z.string().optional(),
  }),
});
