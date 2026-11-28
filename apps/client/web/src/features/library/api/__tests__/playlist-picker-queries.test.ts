import { search } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { libraryVideo } from '#app/__tests__/library-fixtures';
import { person } from '#app/features/library/__tests__/playlist-people';
import { channelSearchQueryOptions } from '../playlist-picker-queries';

const ANA = { ...person(1, 'Ana'), bio: '', subscriberCount: 0 };

describe('apps/client/web: playlist picker queries', () => {
  it('searches channels alone, without recording a search, and keeps only the channels', async () => {
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(search, ({ request }) => {
        asked.push(new URL(request.url).searchParams.toString());
        return HttpResponse.json({
          items: [
            { type: 'channel', data: ANA },
            { type: 'video', data: libraryVideo(1) },
          ],
          nextCursor: null,
          tookMs: 1,
          total: 2,
          fuzzyFallback: false,
        });
      })
    );

    const channels = await createQueryClient().query(channelSearchQueryOptions(api, 'ana'));

    expect(asked).toEqual(['q=ana&type=channel&limit=8&record=false']);
    expect(channels).toEqual([ANA]);
  });

  it('asks nothing for an empty search', () => {
    expect(channelSearchQueryOptions(api, '').enabled).toBe(false);
    expect(channelSearchQueryOptions(api, 'ana').enabled).toBe(true);
  });
});
