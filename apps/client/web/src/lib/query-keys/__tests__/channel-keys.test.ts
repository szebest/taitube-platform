import { getChannel, getChannelFeatured } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, CHANNEL_ID, channel, mockEndpoint, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { channelQueryOptions, channelStartHereQueryOptions } from '../channel-keys';

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

  it('loads the shelf with the source the API decided, keyed apart from the channel', async () => {
    apiServer.use(
      mockEndpoint(getChannelFeatured, ({ params }) =>
        HttpResponse.json({
          source: 'pinned' as const,
          items: [videoSummary({ title: String(params.idOrHandle) })],
        })
      )
    );

    const options = channelStartHereQueryOptions(api, CHANNEL_ID);
    const loaded = await createQueryClient().fetchQuery(options);

    expect(loaded).toMatchObject({ source: 'pinned', items: [{ title: CHANNEL_ID }] });
    expect(options.queryKey).not.toEqual(channelQueryOptions(api, CHANNEL_ID).queryKey);
  });
});
