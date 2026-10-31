import { listAdminVideos } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { adminVideo } from '#app/features/admin/components/__tests__/moderation.fixture';
import { pickableVideosQueryOptions } from '../pick-videos';

describe('apps/client/studio: pickableVideosQueryOptions', () => {
  it.each([
    { typed: ' cats ', q: 'cats' },
    { typed: '  ', q: null },
  ])('asks for public, ready videos titled $q when $typed is typed', async ({ typed, q }) => {
    const asked: URLSearchParams[] = [];
    const video = adminVideo();
    apiServer.use(
      mockEndpoint(listAdminVideos, ({ request }) => {
        asked.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [video], nextCursor: null });
      })
    );

    await expect(
      createQueryClient().fetchQuery(pickableVideosQueryOptions(api, typed))
    ).resolves.toEqual([video]);

    expect(asked[0]?.get('visibility')).toBe('public');
    expect(asked[0]?.get('status')).toBe('READY');
    expect(asked[0]?.get('q')).toBe(q);
  });
});
