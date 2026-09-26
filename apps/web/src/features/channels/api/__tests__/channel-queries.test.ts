import { getChannel } from '@vp/api-contracts';
import { HttpResponse } from 'msw';
import { CHANNEL_ID, channel } from '#app/__tests__/fixtures';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint } from '#app/__tests__/msw/mock-endpoint';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { channelKeys, channelQueryOptions } from '../channel-queries';

describe('apps/web: channel queries', () => {
  it('keys the channel by its id under the channels key', () => {
    expect(channelQueryOptions(CHANNEL_ID).queryKey).toEqual([
      ...channelKeys.all,
      'detail',
      CHANNEL_ID,
    ]);
  });

  it('loads the channel through the API client', async () => {
    apiServer.use(
      mockEndpoint(getChannel, ({ params }) =>
        HttpResponse.json(channel({ id: String(params.idOrHandle), displayName: 'Studio' }))
      )
    );

    const loaded = await createQueryClient().fetchQuery(channelQueryOptions(CHANNEL_ID));

    expect(loaded).toMatchObject({ id: CHANNEL_ID, displayName: 'Studio' });
  });
});
