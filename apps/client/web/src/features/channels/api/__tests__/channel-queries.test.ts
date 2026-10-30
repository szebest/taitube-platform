import { getChannel, listChannelVideos } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, CHANNEL_ID, channel, mockEndpoint, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { channelQueryOptions, channelVideosQueryOptions } from '../channel-queries';

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

  it('loads the first page of the channel videos, keyed apart from the channel', async () => {
    apiServer.use(
      mockEndpoint(listChannelVideos, () =>
        HttpResponse.json({ items: [videoSummary({ title: 'One' })], nextCursor: null, total: 1 })
      )
    );

    const { queryKey } = channelVideosQueryOptions(api, CHANNEL_ID);
    const loaded = await createQueryClient().fetchQuery(channelVideosQueryOptions(api, CHANNEL_ID));

    expect(loaded.items).toMatchObject([{ title: 'One' }]);
    expect(queryKey).not.toEqual(channelQueryOptions(api, CHANNEL_ID).queryKey);
  });
});
