import { PLAYLIST_STATS_RANGES } from '@vp/domain';
import { z } from 'zod';
import { ACCOUNT_ACTIONS } from '#app/lib/account-action/account-actions';
import { createUrlModals } from './create-url-modals';

export const urlModals = createUrlModals({
  'clear-history': z.object({ scope: z.enum(['history', 'searches']) }),
  'save-to-playlist': z.object({ videoId: z.uuid() }),
  'new-playlist': z.object({}),
  'watch-together': z.object({ videoId: z.uuid().optional() }),
  'delete-playlist': z.object({ playlistId: z.uuid() }),
  'sign-in': z.object({
    reason: z.enum(ACCOUNT_ACTIONS),
    redirect: z.string().optional(),
    intent: z.string().optional(),
  }),
  'playlist-item': z.object({ itemId: z.uuid() }),
  'playlist-section': z.object({ sectionId: z.uuid().optional() }),
  'playlist-transfer': z.object({ transfer: z.enum(['move', 'copy']) }),
  'playlist-merge': z.object({}),
  'playlist-import': z.object({ direction: z.enum(['import', 'export']) }),
  'playlist-collaborators': z.object({}),
  'playlist-activity': z.object({}),
  'playlist-share-links': z.object({}),
  'playlist-stats': z.object({ range: z.enum(PLAYLIST_STATS_RANGES).optional() }),
  'playlist-settings': z.object({}),
  'playlist-rules': z.object({}),
});
