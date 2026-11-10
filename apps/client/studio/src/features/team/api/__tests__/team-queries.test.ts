import { createQueryClient } from '@vp/queries';
import { api, apiServer } from '@vp/web-testing';
import { myInvite, serveTeam } from '#app/features/team/__tests__/team-api.fixture';
import {
  auditQueryOptions,
  channelLookupQueryOptions,
  myInvitesQueryOptions,
  teamKeys,
  teamQueryOptions,
} from '../team-queries';

describe('apps/client/studio: team queries', () => {
  it('keys every query under one root, so one invalidation reaches them all', () => {
    expect(
      [
        teamQueryOptions(api).queryKey,
        myInvitesQueryOptions(api).queryKey,
        auditQueryOptions(api, { action: 'member.left' }).queryKey,
        channelLookupQueryOptions(api, 'creator').queryKey,
      ].every((key) => key[0] === teamKeys.all[0])
    ).toBe(true);
  });

  it('keeps one audit log per set of filters', () => {
    expect(auditQueryOptions(api, {}).queryKey).not.toEqual(
      auditQueryOptions(api, { action: 'member.left' }).queryKey
    );
  });

  it('reads the first page of the invites the API lists', async () => {
    const { handlers } = serveTeam({ myInvites: [myInvite('moderator')] });
    apiServer.use(...handlers);

    const { pages } = await createQueryClient().fetchInfiniteQuery(myInvitesQueryOptions(api));

    expect(pages.flatMap(({ items }) => items.map(({ role }) => role))).toEqual(['moderator']);
  });

  it('asks about no channel until there is a handle', () => {
    expect(channelLookupQueryOptions(api, '').enabled).toBe(false);
    expect(channelLookupQueryOptions(api, 'creator').enabled).toBe(true);
  });
});
