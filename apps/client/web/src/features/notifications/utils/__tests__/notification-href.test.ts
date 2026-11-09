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
  ])('$case', ({ kind, payload, href }) => {
    expect(notificationHref(notification({ kind }, payload))).toBe(href);
  });
});
