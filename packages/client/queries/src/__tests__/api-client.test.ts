import { getVideo } from '@vp/api-contracts';
import { LOCAL_API_BASE_URL, VIDEO_ID, apiServer, mockEndpoint, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { createAppApiClient } from '../api-client';
import { inRequest } from './in-request';

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

describe('@vp/queries: createAppApiClient on the server', () => {
  it.each([
    { viewer: 'a signed-in viewer', cookie: 'vp.session=t0ken', authorization: 'Bearer t0ken' },
    { viewer: 'a guest', cookie: '', authorization: null },
  ])(
    'calls the API at its base URL as $viewer, from the session cookie',
    async ({ cookie, authorization }) => {
      const sent = recordAuthorization();
      const api = createAppApiClient({ apiBaseUrl: LOCAL_API_BASE_URL, onUnauthorized: vi.fn() });

      await inRequest(() => api.videos.getVideo({ params: { id: VIDEO_ID } }), { cookie });

      expect(sent).toEqual([authorization]);
    }
  );
});
