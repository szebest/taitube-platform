import { getChannel, getChannelFeatured, getChannelSpotlight } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, CHANNEL_ID, channel, mockEndpoint, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import {
  channelQueryOptions,
  channelSpotlightQueryOptions,
  channelSpotlightScope,
  channelStartHereQueryOptions,
} from '../channel-keys';

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

    const loaded = await createQueryClient().query(channelQueryOptions(api, CHANNEL_ID));

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
    const loaded = await createQueryClient().query(options);

    expect(loaded).toMatchObject({ source: 'pinned', items: [{ title: CHANNEL_ID }] });
    expect(options.queryKey).not.toEqual(channelQueryOptions(api, CHANNEL_ID).queryKey);
  });

  it.each([
    { name: 'the locale', other: channelSpotlightQueryOptions(api, 'a', 'pl', null) },
    { name: 'the viewer', other: channelSpotlightQueryOptions(api, 'a', 'en', 'u1') },
    { name: 'the channel', other: channelSpotlightQueryOptions(api, 'b', 'en', null) },
  ])('keys the spotlight apart by $name', ({ other }) => {
    expect(channelSpotlightQueryOptions(api, 'a', 'en', null).queryKey).not.toEqual(other.queryKey);
  });

  it('keys every spotlight of a channel under its scope', () => {
    expect(channelSpotlightQueryOptions(api, 'a', 'en', 'u1').queryKey.slice(0, 3)).toEqual(
      channelSpotlightScope('a')
    );
  });

  it('asks for the spotlight in the locale it is keyed by', async () => {
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(getChannelSpotlight, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('locale') ?? '');
        return HttpResponse.json({ source: null, video: null });
      })
    );

    await createQueryClient().query(channelSpotlightQueryOptions(api, CHANNEL_ID, 'pl', null));

    expect(asked).toEqual(['pl']);
  });
});
