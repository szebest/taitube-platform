import { getChannel } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { CHANNEL_ID, apiServer, channel } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { api, mockEndpoint } from '#app/__tests__/api';
import { channelQueryOptions } from '../channel-queries';

describe('apps/client/web: channel queries', () => {
  it('keys the query by the channel, so two channels never share a cache entry', () => {
    expect(channelQueryOptions(api, 'a').queryKey).not.toEqual(
      channelQueryOptions(api, 'b').queryKey
    );
  });

  it('loads the channel through the API client', async () => {
    apiServer.use(
      mockEndpoint(getChannel, ({ params }) =>
        HttpResponse.json(channel({ id: String(params.idOrHandle), displayName: 'Studio' }))
      )
    );

    const loaded = await createQueryClient().fetchQuery(channelQueryOptions(api, CHANNEL_ID));

    expect(loaded).toMatchObject({ id: CHANNEL_ID, displayName: 'Studio' });
  });
});
