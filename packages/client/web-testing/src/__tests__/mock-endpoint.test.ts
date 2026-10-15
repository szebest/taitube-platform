import { ApiError, createApiClient } from '@vp/api-client';
import { getVideo, updateVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { HttpResponse } from 'msw/http';

import { apiServer } from '../api-server';
import { VIDEO_ID, video } from '../fixtures';
import { createEndpointMocks, problemReply } from '../mock-endpoint';

const BASE_URL = 'http://localhost:3000';
const { mockEndpoint } = createEndpointMocks(BASE_URL);
const apiClient = createApiClient({ baseUrl: BASE_URL });

describe('@vp/web-testing: mockEndpoint', () => {
  it('answers the call apiClient makes for the contract', async () => {
    apiServer.use(mockEndpoint(getVideo, () => HttpResponse.json(video({ title: 'Launch day' }))));

    const answered = await apiClient.videos.getVideo({ params: { id: VIDEO_ID } });

    expect(answered).toEqual(video({ title: 'Launch day' }));
  });

  it("hands the resolver the contract's path params and body", async () => {
    const seen: unknown[] = [];
    apiServer.use(
      mockEndpoint(updateVideo, async ({ params, request }) => {
        seen.push(params.id, await request.json());
        return HttpResponse.json(video());
      })
    );

    await apiClient.videos.updateVideo({
      params: { id: VIDEO_ID },
      body: { title: 'x', version: 3 },
    });

    expect(seen).toEqual([VIDEO_ID, { title: 'x', version: 3 }]);
  });

  it.each([
    { code: ErrorCodes.VIDEO_NOT_FOUND, status: 404 },
    { code: ErrorCodes.INTERNAL, status: 500 },
  ])('answers $code as the API does, at $status', async ({ code, status }) => {
    apiServer.use(mockEndpoint(getVideo, () => problemReply(code)));

    const answered = apiClient.videos.getVideo({ params: { id: VIDEO_ID } });

    await expect(answered).rejects.toEqual(expect.any(ApiError));
    await expect(answered).rejects.toMatchObject({ status, code });
  });

  it('refuses to compile a body the contract does not return', () => {
    // @ts-expect-error a video has no numeric title
    mockEndpoint(getVideo, () => HttpResponse.json({ ...video(), title: 1 }));
  });

  it('refuses to compile a path param the contract does not declare', () => {
    // @ts-expect-error getVideo takes an id, not a slug
    mockEndpoint(getVideo, ({ params }) => HttpResponse.json(video({ title: params.slug })));
  });
});
