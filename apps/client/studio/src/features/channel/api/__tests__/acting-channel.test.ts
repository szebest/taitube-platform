import { getMyChannel } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, channel, CHANNEL_ID, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw';
import { actingChannelKeys, actingChannelQueryOptions } from '../acting-channel';

describe('apps/client/studio: acting channel query', () => {
  it('reads the acting channel, under a key that names it', async () => {
    apiServer.use(
      mockEndpoint(getMyChannel, () => HttpResponse.json(channel({ handle: 'acting' })))
    );

    const loaded = await createQueryClient().query(actingChannelQueryOptions(api, CHANNEL_ID));

    expect(loaded.handle).toBe('acting');
    expect(actingChannelQueryOptions(api, CHANNEL_ID).queryKey).toEqual([
      'channel',
      'acting',
      CHANNEL_ID,
    ]);
  });

  it('keeps the channels of a team apart', () => {
    expect(actingChannelKeys.channel('a')).not.toEqual(actingChannelKeys.channel('b'));
  });
});
