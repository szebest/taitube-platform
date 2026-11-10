import { VIDEO_ID } from '@vp/web-testing';
import { notification } from '#app/features/notifications/__tests__/notification-fixtures';
import { notificationHref } from '../notification-href';

const INVITE_ID = '0190c3a0-5e1d-7000-8000-0000000dd002';

describe('apps/client/web: notificationHref', () => {
  it.each([
    {
      case: 'a team invite opens the invite in the studio',
      kind: 'team_invite' as const,
      payload: { inviteId: INVITE_ID },
      href: `http://localhost:5174/invites?invite=${INVITE_ID}`,
    },
    {
      case: 'a team invite from before the invite id was carried opens nothing',
      kind: 'team_invite' as const,
      payload: {},
      href: undefined,
    },
    {
      case: 'a reply stays in the viewer app',
      kind: 'reply' as const,
      payload: {},
      href: undefined,
    },
    {
      case: 'a video held by screening opens its editor in the studio',
      kind: 'processing' as const,
      payload: { outcome: 'held' as const },
      href: `http://localhost:5174/videos/${VIDEO_ID}/edit`,
    },
    {
      case: 'a screening rejection opens its editor, where the appeal is',
      kind: 'processing' as const,
      payload: { outcome: 'rejected' as const },
      href: `http://localhost:5174/videos/${VIDEO_ID}/edit`,
    },
    {
      case: 'an approved video opens in the viewer app, where it plays',
      kind: 'processing' as const,
      payload: { outcome: 'approved' as const },
      href: undefined,
    },
    {
      case: 'a held video with no video id opens nothing',
      kind: 'processing' as const,
      payload: { outcome: 'held' as const },
      videoId: null,
      href: undefined,
    },
  ])('$case', ({ kind, payload, href, ...rest }) => {
    const videoId = 'videoId' in rest ? rest.videoId : VIDEO_ID;
    expect(notificationHref(notification({ kind, videoId }, payload))).toBe(href);
  });
});
