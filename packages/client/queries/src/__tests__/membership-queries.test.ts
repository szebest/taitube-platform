import { type ChannelMembershipView, listMyMemberships } from '@vp/api-contracts';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { createQueryClient } from '../create-query-client';
import { membershipKeys, membershipsQueryOptions } from '../membership-queries';

const MEMBERSHIP: ChannelMembershipView = {
  channelId: '0190c3a0-5e1d-7000-8000-00000000c002',
  ownerId: '0190c3a0-5e1d-7000-8000-00000000b002',
  role: 'moderator',
  channel: { handle: 'other', displayName: 'Other', avatarUrl: null },
};

describe('@vp/queries: membership queries', () => {
  it('keys the memberships under the team root', () => {
    expect(membershipsQueryOptions(api).queryKey).toEqual(membershipKeys.all);
  });

  it('reads the memberships the API lists', async () => {
    apiServer.use(
      mockEndpoint(listMyMemberships, () => HttpResponse.json({ items: [MEMBERSHIP] }))
    );

    const { items } = await createQueryClient().fetchQuery(membershipsQueryOptions(api));

    expect(items.map(({ role }) => role)).toEqual(['moderator']);
  });
});
