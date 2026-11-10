import { getWatchParty } from '@vp/api-contracts';
import { api, apiServer, mockEndpoint, PARTY_ID, partyRoom } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { createQueryClient } from '../create-query-client';
import {
  myWatchPartiesQueryOptions,
  watchPartyKeys,
  watchPartyPreviewQueryOptions,
} from '../watch-party-queries';

describe('@vp/queries: watch party queries', () => {
  it('keys a preview by the room and the invite, so an invite never shares an entry with the bare link', () => {
    expect(watchPartyPreviewQueryOptions(api, PARTY_ID).queryKey).not.toEqual(
      watchPartyPreviewQueryOptions(api, PARTY_ID, 'invite-1').queryKey
    );
  });

  it.each([
    { query: 'the preview', queryKey: watchPartyPreviewQueryOptions(api, PARTY_ID).queryKey },
    { query: 'my rooms', queryKey: myWatchPartiesQueryOptions(api).queryKey },
  ])('files $query under the watch parties key', ({ queryKey }) => {
    expect(queryKey.slice(0, watchPartyKeys.all.length)).toEqual([...watchPartyKeys.all]);
  });

  it('loads a preview with the invite as a query parameter', async () => {
    let seen: string | null = null;
    apiServer.use(
      mockEndpoint(getWatchParty, ({ request }) => {
        seen = new URL(request.url).searchParams.get('invite');
        return HttpResponse.json({
          ...partyRoom(),
          features: { voice: false },
          roster: { faces: [], others: 0, discord: 0, guests: 0, total: 0 },
          viewer: {
            memberKey: null,
            permissions: [],
            roleIds: [],
            canJoin: 'yes',
            actions: ['guest', 'sign_in'],
          },
        });
      })
    );

    const loaded = await createQueryClient().query(
      watchPartyPreviewQueryOptions(api, PARTY_ID, 'invite-1')
    );

    expect(seen).toBe('invite-1');
    expect(loaded.name).toBe('Movie night');
  });
});
