import { VIDEO_ID, apiServer, video } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';

import { createAppApiClient } from '../api-client';

describe('@vp/queries: createAppApiClient in the browser', () => {
  it("calls its own origin's /api, never the API's address", async () => {
    const asked: string[] = [];
    apiServer.use(
      http.get(`${window.location.origin}/api/v1/videos/:id`, ({ request }) => {
        asked.push(request.url);
        return HttpResponse.json(video());
      })
    );

    await createAppApiClient('http://api.internal:3000').videos.getVideo({
      params: { id: VIDEO_ID },
    });

    expect(asked).toEqual([`${window.location.origin}/api/v1/videos/${VIDEO_ID}`]);
  });
});
