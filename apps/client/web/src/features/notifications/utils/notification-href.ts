import type { Notification } from '@vp/api-contracts';

/**
 * Where a notification that lives in the studio goes: the invite a `team_invite` names, or the
 * editor of a video on hold or rejected, which is not watchable and where its appeal is.
 * `undefined` for the rest. `studioLink` turns a studio path into a link as this tab's identity.
 */
export function notificationHref(
  { kind, videoId, payload }: Notification,
  studioLink: (path: string) => string
): string | undefined {
  if (kind === 'team_invite' && payload.inviteId) {
    return studioLink(`/invites?${new URLSearchParams({ invite: payload.inviteId })}`);
  }

  const answeredInStudio = payload.outcome === 'held' || payload.outcome === 'rejected';
  if (kind === 'processing' && videoId && answeredInStudio) {
    return studioLink(`/videos/${videoId}/edit`);
  }

  return undefined;
}
