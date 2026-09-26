import { getVideo } from '@vp/api-contracts';
import { HttpResponse } from 'msw';
import { stubBrowser } from '#app/__tests__/browser';
import { VIDEO_ID, video } from '#app/__tests__/fixtures';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint } from '#app/__tests__/msw/mock-endpoint';
import { apiClient } from '../api-client';

function recordAuthorization(): (string | null)[] {
  const sent: (string | null)[] = [];
  apiServer.use(
    mockEndpoint(getVideo, ({ request }) => {
      sent.push(request.headers.get('authorization'));
      return HttpResponse.json(video());
    })
  );
  return sent;
}

describe('apps/web: apiClient', () => {
  it('calls the configured API host', async () => {
    recordAuthorization();

    await expect(apiClient.videos.getVideo({ params: { id: VIDEO_ID } })).resolves.toEqual(video());
  });

  it.each([
    { viewer: 'a signed-in viewer', token: 'signed-in', authorization: 'Bearer signed-in' },
    { viewer: 'a guest', token: undefined, authorization: null },
  ])('authenticates $viewer from the stored token', async ({ token, authorization }) => {
    stubBrowser({ token });
    const sent = recordAuthorization();

    await apiClient.videos.getVideo({ params: { id: VIDEO_ID } });

    expect(sent).toEqual([authorization]);
  });
});
