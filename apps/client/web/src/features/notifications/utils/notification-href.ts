import type { Notification } from '@vp/api-contracts';
import { STUDIO_URL } from '#app/lib/config';

/** Where a notification that lives in the studio goes: the invite a `team_invite` names, or the editor of a video on hold or rejected, which is not watchable and where its appeal is. `undefined` for the rest. */
export function notificationHref({ kind, videoId, payload }: Notification): string | undefined {
  if (kind === 'team_invite' && payload.inviteId) {
    const href = new URL('/invites', STUDIO_URL);
    href.searchParams.set('invite', payload.inviteId);
    return href.toString();
  }

  const answeredInStudio = payload.outcome === 'held' || payload.outcome === 'rejected';
  if (kind === 'processing' && videoId && answeredInStudio) {
    return new URL(`/videos/${videoId}/edit`, STUDIO_URL).toString();
  }

  return undefined;
}
