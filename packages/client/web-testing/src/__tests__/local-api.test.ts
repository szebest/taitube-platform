import { getVideo } from '@vp/api-contracts';
import { HttpResponse } from 'msw/http';

import { apiServer } from '../api-server';
import { video } from '../fixtures';
import { LOCAL_API_BASE_URL, api, mockEndpoint } from '../local-api';

describe('@vp/web-testing: the local API a spec talks to', () => {
  it('answers the client at the address every app defaults to', async () => {
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(getVideo, ({ request }) => {
        asked.push(request.url);
        return HttpResponse.json(video({ title: 'Launch day' }));
      })
    );

    const fetched = await api.videos.getVideo({ params: { id: video().id } });

    expect(fetched.title).toBe('Launch day');
    expect(asked).toEqual([`${LOCAL_API_BASE_URL}/v1/videos/${video().id}`]);
  });
});
