import type { Notification } from '@vp/api-contracts';
import { CHANNEL_ID, PARTY_ID, VIDEO_ID } from '@vp/web-testing';

export const NOTIFICATION_ID = '0190c3a0-5e1d-7000-8000-0000000000e1';
export const SECOND_NOTIFICATION_ID = '0190c3a0-5e1d-7000-8000-0000000000e2';
export const COMMENT_ID = '0190c3a0-5e1d-7000-8000-0000000000c9';

export function notification(
  overrides: Partial<Notification> = {},
  payload: Partial<Notification['payload']> = {}
): Notification {
  return {
    id: NOTIFICATION_ID,
    kind: 'upload',
    actorChannelId: CHANNEL_ID,
    videoId: VIDEO_ID,
    commentId: null,
    read: false,
    createdAt: '2026-01-02T03:04:05.000Z',
    ...overrides,
    payload: {
      count: 1,
      actor: { handle: 'night-kitchen', displayName: 'Night Kitchen', avatarUrl: null },
      videoTitle: 'Midnight ramen',
      excerpt: null,
      outcome: null,
      party: null,
      ...payload,
    },
  };
}

export const PARTY_INVITE_ID = '0190c3a0-5e1d-7000-8000-0000000000f2';

export function partyInvite(party: Partial<NonNullable<Notification['payload']['party']>> = {}) {
  return notification(
    { kind: 'party_invite', videoId: null },
    {
      party: {
        roomId: PARTY_ID,
        name: 'Movie night',
        videoTitle: 'Big Buck Bunny',
        scheduledFor: null,
        inviteId: PARTY_INVITE_ID,
        expiresAt: '2999-01-01T00:00:00.000Z',
        watching: { names: ['Ana', 'Tom'], count: 5 },
        ...party,
      },
    }
  );
}
