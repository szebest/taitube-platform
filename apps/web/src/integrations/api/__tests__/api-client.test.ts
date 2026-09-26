import { jsonResponse } from '#app/__tests__/api-store';
import { stubBrowser } from '#app/__tests__/browser';
import { VIDEO_ID, video } from '#app/__tests__/fixtures';
import { API_BASE_URL } from '#app/config';
import { apiClient } from '../api-client';

type Sent = { url: string; headers: Headers };

function recordSent(): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    sent.push({ url, headers: new Headers(init.headers) });
    return jsonResponse(video());
  });
  return sent;
}

describe('apps/web: apiClient', () => {
  it('calls the configured API host', async () => {
    const sent = recordSent();

    await apiClient.videos.getVideo({ params: { id: VIDEO_ID } });

    expect(sent.map(({ url }) => url)).toEqual([`${API_BASE_URL}/v1/videos/${VIDEO_ID}`]);
  });

  it.each([
    { viewer: 'a signed-in viewer', token: 'signed-in', authorization: 'Bearer signed-in' },
    { viewer: 'a guest', token: undefined, authorization: null },
  ])('authenticates $viewer from the stored token', async ({ token, authorization }) => {
    stubBrowser({ token });
    const sent = recordSent();

    await apiClient.videos.getVideo({ params: { id: VIDEO_ID } });

    expect(sent[0]?.headers.get('authorization')).toBe(authorization);
  });
});
