import { getChannel, getChannelFeatured, getChannelSpotlight } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient, GUEST } from '@vp/queries';
import {
  account,
  api,
  apiServer,
  CHANNEL_ID,
  channel,
  mockEndpoint,
  problemReply,
  videoSummary,
} from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import {
  channelQueryOptions,
  channelSpotlightQueryOptions,
} from '#app/lib/query-keys/channel-keys';
import { loadChannelPage } from '../load-channel-page';

const FEATURED = { source: 'popular' as const, items: [videoSummary({ title: 'Shelf video' })] };

function answer(fields: Parameters<typeof channel>[0] = {}) {
  apiServer.use(
    mockEndpoint(getChannel, () => HttpResponse.json(channel(fields))),
    mockEndpoint(getChannelFeatured, () => HttpResponse.json(FEATURED)),
    mockEndpoint(getChannelSpotlight, () => HttpResponse.json({ source: null, video: null }))
  );
}

const load = (idOrHandle: string, auth: Parameters<typeof loadChannelPage>[0]['auth'] = GUEST) => {
  const queryClient = createQueryClient();
  return {
    queryClient,
    loaded: loadChannelPage({ queryClient, api, locale: 'pl', auth }, idOrHandle),
  };
};

describe('apps/client/web: loadChannelPage', () => {
  it('loads the channel and its shelf, and keeps the channel under its id whatever address named it', async () => {
    answer();

    const { queryClient, loaded } = load('creator');

    await expect(loaded).resolves.toMatchObject({
      channel: { id: CHANNEL_ID },
      videos: [{ title: 'Shelf video' }],
    });
    expect(queryClient.getQueryData(channelQueryOptions(api, CHANNEL_ID).queryKey)).toMatchObject({
      handle: 'creator',
    });
  });

  it.each([
    { viewer: 'a guest', auth: GUEST, viewerId: null },
    {
      viewer: 'a signed-in viewer',
      auth: { status: 'signed-in' as const, account: account() },
      viewerId: account().id,
    },
  ])('warms the spotlight for $viewer in the negotiated locale', async ({ auth, viewerId }) => {
    answer();

    const { queryClient, loaded } = load(CHANNEL_ID, auth);
    await loaded;

    expect(
      queryClient.getQueryData(
        channelSpotlightQueryOptions(api, CHANNEL_ID, 'pl', viewerId).queryKey
      )
    ).toEqual({ source: null, video: null });
  });

  it('sends a retired handle on to the current one with a 301', async () => {
    answer({ handle: 'new-name', redirectedFrom: 'old-name' });

    const { loaded } = load('old-name');

    await expect(loaded).rejects.toMatchObject({
      options: { to: '/@{$handle}', params: { handle: 'new-name' }, statusCode: 301 },
    });
  });

  it('renders not found for a channel the API does not have', async () => {
    apiServer.use(mockEndpoint(getChannel, () => problemReply(ErrorCodes.CHANNEL_NOT_FOUND)));

    const { loaded } = load('nobody');

    await expect(loaded).rejects.toMatchObject({ isNotFound: true });
  });

  it('still loads the page when the spotlight cannot be read', async () => {
    answer();
    apiServer.use(mockEndpoint(getChannelSpotlight, () => problemReply(ErrorCodes.INTERNAL)));

    const { loaded } = load(CHANNEL_ID);

    await expect(loaded).resolves.toMatchObject({ channel: { id: CHANNEL_ID } });
  });
});
