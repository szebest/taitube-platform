import { VIEWER_SESSION_HEADER } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { VIDEO_ID, apiServer, problemReply, video } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';
import { createAppApiClient } from '../api-client';

const PROXIED_VIDEO = `${window.location.origin}/api/v1/videos/${VIDEO_ID}`;

function browserClient(onUnauthorized = vi.fn(), getViewerSession?: () => string) {
  return createAppApiClient({
    apiBaseUrl: 'http://api.internal:3000',
    onUnauthorized,
    getViewerSession,
  });
}

describe('@vp/queries: createAppApiClient in the browser', () => {
  it("calls its own origin's /api, never the API's address", async () => {
    const asked: string[] = [];
    apiServer.use(
      http.get(PROXIED_VIDEO, ({ request }) => {
        asked.push(request.url);
        return HttpResponse.json(video());
      })
    );

    await browserClient().videos.getVideo({ params: { id: VIDEO_ID } });

    expect(asked).toEqual([PROXIED_VIDEO]);
  });

  it.each([
    { answer: 'a 401', code: ErrorCodes.UNAUTHORIZED, told: 1 },
    { answer: 'a 403', code: ErrorCodes.FORBIDDEN, told: 0 },
  ])('tells the router of $answer: $told time(s)', async ({ code, told }) => {
    apiServer.use(http.get(PROXIED_VIDEO, () => problemReply(code)));
    const onUnauthorized = vi.fn();

    await expect(
      browserClient(onUnauthorized).videos.getVideo({ params: { id: VIDEO_ID } })
    ).rejects.toThrow();

    expect(onUnauthorized).toHaveBeenCalledTimes(told);
  });

  it.each([
    { app: 'that keeps a viewer session', getViewerSession: () => 'tab-key', sent: 'tab-key' },
    { app: 'that keeps none', getViewerSession: undefined, sent: null },
  ])('names the tab to the API from an app $app', async ({ getViewerSession, sent }) => {
    const named: (string | null)[] = [];
    apiServer.use(
      http.get(PROXIED_VIDEO, ({ request }) => {
        named.push(request.headers.get(VIEWER_SESSION_HEADER));
        return HttpResponse.json(video());
      })
    );

    await browserClient(vi.fn(), getViewerSession).videos.getVideo({ params: { id: VIDEO_ID } });

    expect(named).toEqual([sent]);
  });
});
