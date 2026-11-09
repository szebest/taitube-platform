import { createQueryClient } from '@vp/queries';
import { api, apiServer } from '@vp/web-testing';
import { membership, serveTeam } from '#app/features/team/__tests__/team-api.fixture';
import {
  auditQueryOptions,
  channelLookupQueryOptions,
  membershipsQueryOptions,
  teamKeys,
  teamQueryOptions,
} from '../team-queries';

describe('apps/client/studio: team queries', () => {
  it('keys every query under one root, so one invalidation reaches them all', () => {
    expect(
      [
        teamQueryOptions(api).queryKey,
        membershipsQueryOptions(api).queryKey,
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

  it('reads the memberships the API lists', async () => {
    const { handlers } = serveTeam({ memberships: [membership('editor')] });
    apiServer.use(...handlers);

    const { items } = await createQueryClient().fetchQuery(membershipsQueryOptions(api));

    expect(items.map(({ role }) => role)).toEqual(['editor']);
  });

  it('asks about no channel until there is a handle', () => {
    expect(channelLookupQueryOptions(api, '').enabled).toBe(false);
    expect(channelLookupQueryOptions(api, 'creator').enabled).toBe(true);
  });
});
