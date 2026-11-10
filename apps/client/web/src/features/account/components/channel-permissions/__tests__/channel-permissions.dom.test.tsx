import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { listMyMemberships } from '@vp/api-contracts';
import { canModerateComment } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, OWNER_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { ComponentType, PropsWithChildren } from 'react';
import { membershipOn, OTHER_ID, viewerAccount } from '#app/__tests__/comment-fixtures';
import { signedIn } from '#app/__tests__/providers';
import { ChannelPermissions } from '../channel-permissions';

function mayHide(Session: ComponentType<PropsWithChildren>) {
  const queryClient = createQueryClient();
  return renderHook(() => useCan(canModerateComment, { action: 'hide', videoOwnerId: OWNER_ID }), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>
        <Session>
          <ChannelPermissions>{children}</ChannelPermissions>
        </Session>
      </QueryClientProvider>
    ),
  }).result;
}

describe('apps/client/web: ChannelPermissions', () => {
  it.each([
    { viewer: 'a moderator of the video channel', role: 'moderator', hides: true },
    { viewer: 'an analyst of the video channel', role: 'analytics', hides: false },
    { viewer: 'a viewer on no team', role: null, hides: false },
  ] as const)('gives $viewer the moderation actions: $hides', async ({ role, hides }) => {
    apiServer.use(
      mockEndpoint(listMyMemberships, () =>
        HttpResponse.json({ items: role ? [membershipOn(role)] : [] })
      )
    );

    const result = mayHide(signedIn(viewerAccount(OTHER_ID)));

    await waitFor(() => expect(result.current).toBe(hides));
  });
});
