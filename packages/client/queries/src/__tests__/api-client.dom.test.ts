import { ErrorCodes } from '@vp/errors';
import { VIDEO_ID, apiServer, problemReply, video } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';
import { createAppApiClient } from '../api-client';

const PROXIED_VIDEO = `${window.location.origin}/api/v1/videos/${VIDEO_ID}`;

function browserClient(onUnauthorized = vi.fn(), slot = 0) {
  return createAppApiClient({
    apiBaseUrl: 'http://api.internal:3000',
    getSlot: () => slot,
    onUnauthorized,
  });
}

describe('@vp/queries: createAppApiClient in the browser', () => {
  it("calls its own origin's /api, never the API's address, naming the router's slot", async () => {
    const asked: { url: string; slot: string | null }[] = [];
    apiServer.use(
      http.get(PROXIED_VIDEO, ({ request }) => {
        asked.push({ url: request.url, slot: request.headers.get('x-account-slot') });
        return HttpResponse.json(video());
      })
    );

    await browserClient(vi.fn(), 3).videos.getVideo({ params: { id: VIDEO_ID } });

    expect(asked).toEqual([{ url: PROXIED_VIDEO, slot: '3' }]);
  });

  it.each([
    { answer: 'a 401', code: ErrorCodes.UNAUTHORIZED, told: 1 },
    { answer: 'a 403', code: ErrorCodes.FORBIDDEN, told: 0 },
  ])(
    'tells the router of $answer, with the slot it went as: $told time(s)',
    async ({ code, told }) => {
      apiServer.use(http.get(PROXIED_VIDEO, () => problemReply(code)));
      const onUnauthorized = vi.fn();

      await expect(
        browserClient(onUnauthorized, 2).videos.getVideo({ params: { id: VIDEO_ID } })
      ).rejects.toThrow();

      expect(onUnauthorized.mock.calls).toEqual(Array.from({ length: told }, () => [2]));
    }
  );
});
