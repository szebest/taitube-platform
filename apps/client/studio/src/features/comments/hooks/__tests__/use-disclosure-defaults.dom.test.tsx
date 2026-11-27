import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { getCommentSettings } from '@vp/api-contracts';
import { DEFAULT_COMMENT_SETTINGS, type ChannelRole } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { PermissionsProvider } from '@vp/permissions-react';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import { useDisclosureDefaults } from '../use-disclosure-defaults';
import { ModerationChannelProvider } from '../use-moderation-channel';

const CHANNEL = { channelId: 'channel-1', ownerId: 'owner-1' };
const DISCLOSURE = { ...DEFAULT_COMMENT_SETTINGS.disclosure, hide: 'visible' as const };
const SETTINGS = {
  ...DEFAULT_COMMENT_SETTINGS,
  blockedWords: [],
  linkAllowlist: [],
  disclosure: DISCLOSURE,
};

const renderDefaults = (role: ChannelRole | 'owner') => {
  const viewer: UserContext =
    role === 'owner'
      ? { id: CHANNEL.ownerId, role: 'CREATOR' }
      : {
          id: 'member-1',
          role: 'USER',
          memberships: { [CHANNEL.channelId]: { ownerId: CHANNEL.ownerId, role } },
        };
  const client = createQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <AppProviders>
      <QueryClientProvider client={client}>
        <ModerationChannelProvider channel={CHANNEL}>
          <PermissionsProvider userContext={viewer}>{children}</PermissionsProvider>
        </ModerationChannelProvider>
      </QueryClientProvider>
    </AppProviders>
  );
  return renderHook(useDisclosureDefaults, { wrapper });
};

describe('apps/client/studio: useDisclosureDefaults', () => {
  it('gives the channel defaults to a viewer who may read the settings', async () => {
    apiServer.use(mockEndpoint(getCommentSettings, () => HttpResponse.json(SETTINGS)));

    const { result } = renderDefaults('owner');

    await waitFor(() => expect(result.current).toEqual(DISCLOSURE));
  });

  it.each([
    { scenario: 'a moderator, who may not read them', role: 'moderator' as const, status: 200 },
    { scenario: 'the API refusing the read', role: 'owner' as const, status: 403 },
  ])('gives nothing for $scenario', async ({ role, status }) => {
    let asked = 0;
    apiServer.use(
      mockEndpoint(getCommentSettings, () => {
        asked += 1;
        return status === 200 ? HttpResponse.json(SETTINGS) : problemReply(ErrorCodes.FORBIDDEN);
      })
    );

    const { result } = renderDefaults(role);

    await waitFor(() => expect(asked).toBe(role === 'owner' ? 1 : 0));
    expect(result.current).toBeUndefined();
  });
});
