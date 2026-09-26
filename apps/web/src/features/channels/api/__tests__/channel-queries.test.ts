import { jsonResponse, recordRequests } from '#app/__tests__/api-store';
import { CHANNEL_ID, channel } from '#app/__tests__/fixtures';
import { API_BASE_URL } from '#app/config';
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
    const sent = recordRequests(() => jsonResponse(channel({ displayName: 'Studio' })));

    const loaded = await createQueryClient().fetchQuery(channelQueryOptions(CHANNEL_ID));

    expect(loaded.displayName).toBe('Studio');
    expect(sent.map(({ url }) => url)).toEqual([`${API_BASE_URL}/v1/channels/${CHANNEL_ID}`]);
  });
});
