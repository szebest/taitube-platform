import { ToastProvider } from '@kit/ui';
import { declineWatchPartyInvite, markNotificationsRead } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { createElement, type PropsWithChildren } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import {
  NOTIFICATION_ID,
  PARTY_INVITE_ID,
} from '#app/features/notifications/__tests__/notification-fixtures';
import { useDeclinePartyInvite } from '../use-decline-party-invite';

const toaster = { show: () => () => undefined, subscribe: () => () => undefined };

const Providers = ({ children }: PropsWithChildren) =>
  createElement(AppProviders, null, createElement(ToastProvider, { toaster }, children));

describe('apps/client/web: useDeclinePartyInvite', () => {
  it('declines the invite and marks its notification read', async () => {
    const declined: unknown[] = [];
    const marked: unknown[] = [];
    apiServer.use(
      mockEndpoint(declineWatchPartyInvite, ({ params }) => {
        declined.push(params.inviteId);
        return new HttpResponse(null, { status: 204 });
      }),
      mockEndpoint(markNotificationsRead, async ({ request }) => {
        marked.push(await request.json());
        return HttpResponse.json({ unreadCount: 0 });
      })
    );

    await runMutation(
      createQueryClient(),
      useDeclinePartyInvite,
      { inviteId: PARTY_INVITE_ID, notificationId: NOTIFICATION_ID },
      Providers
    );

    expect(declined).toEqual([PARTY_INVITE_ID]);
    await vi.waitFor(() => expect(marked).toEqual([{ ids: [NOTIFICATION_ID] }]));
  });
});
