import type { Notification } from '@vp/api-contracts';
import { STUDIO_URL } from '#app/lib/config';

/** Where a notification that lives in the studio goes: the invite a `team_invite` names. `undefined` for the rest. */
export function notificationHref({ kind, payload }: Notification): string | undefined {
  if (kind !== 'team_invite' || !payload.inviteId) {
    return undefined;
  }

  const href = new URL('/invites', STUDIO_URL);
  href.searchParams.set('invite', payload.inviteId);
  return href.toString();
}
