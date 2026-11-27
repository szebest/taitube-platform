import { getMyChannel, getMySpotlight } from '@vp/api-contracts';
import { type ActingChannelStore, createQueryClient } from '@vp/queries';
import { account, api, apiServer, channel, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw';
import { actingChannelKeys } from '../acting-channel';
import { prefetchCustomization } from '../prefetch-customization';

const OWN = account();
const SPOTLIGHT = { trailerVideoId: null, returningVideoId: null, localizations: [] };
const store = (selected: string | undefined) =>
  ({ read: () => selected, select: () => undefined }) as unknown as ActingChannelStore;

describe('apps/client/studio: prefetchCustomization', () => {
  it.each([
    { scenario: 'the own channel when none is selected', selected: undefined, key: OWN.channel.id },
    { scenario: 'the channel switched to', selected: 'other', key: 'other' },
  ])('loads the acting channel and its spotlight for $scenario', async ({ selected, key }) => {
    apiServer.use(
      mockEndpoint(getMyChannel, () => HttpResponse.json(channel())),
      mockEndpoint(getMySpotlight, () => HttpResponse.json(SPOTLIGHT))
    );
    const queryClient = createQueryClient();

    await prefetchCustomization({
      api,
      queryClient,
      auth: { status: 'signed-in', account: OWN },
      actingChannel: store(selected),
    });

    expect(queryClient.getQueryData(actingChannelKeys.channel(key))).toBeDefined();
  });

  it('loads nothing for a guest', async () => {
    const queryClient = createQueryClient();

    await prefetchCustomization({
      api,
      queryClient,
      auth: { status: 'guest' },
      actingChannel: store(undefined),
    });

    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });
});
