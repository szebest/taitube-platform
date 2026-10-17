import { createApiClient } from '@vp/api-client';
import { getVideo } from '@vp/api-contracts';
import { HttpResponse } from 'msw/http';

import { apiServer } from '../api-server';
import { video } from '../fixtures';
import { api, LOCAL_API_BASE_URL, mockEndpoint } from '../local-api';

describe('@vp/web-testing: the local API a spec talks to', () => {
  it.each([
    { caller: 'the client at the address every app defaults to', client: api },
    {
      caller: "an app's browser client, through its same-origin /api",
      client: createApiClient({ baseUrl: 'http://localhost:5174/api' }),
    },
  ])('answers $caller', async ({ client }) => {
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(getVideo, ({ request }) => {
        asked.push(request.url);
        return HttpResponse.json(video({ title: 'Launch day' }));
      })
    );

    const fetched = await client.videos.getVideo({ params: { id: video().id } });

    expect(fetched.title).toBe('Launch day');
    expect(asked).toEqual([`${LOCAL_API_BASE_URL}/v1/videos/${video().id}`]);
  });
});
