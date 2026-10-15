import { getVideo } from '@vp/api-contracts';
import { VIDEO_ID, apiServer, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from '../auth-token';
import { api, mockEndpoint } from './api';

function storeToken(token: string | undefined): void {
  const stored = token === undefined ? null : token;
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => (key === AUTH_TOKEN_LOCAL_STORAGE_KEY ? stored : null),
    },
  });
}

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

describe('@vp/queries: createAppApiClient', () => {
  it('calls the API at the base URL it is given', async () => {
    storeToken(undefined);
    recordAuthorization();

    await expect(api.videos.getVideo({ params: { id: VIDEO_ID } })).resolves.toEqual(video());
  });

  it.each([
    { viewer: 'a signed-in viewer', token: 'signed-in', authorization: 'Bearer signed-in' },
    { viewer: 'a guest', token: undefined, authorization: null },
  ])('authenticates $viewer from the stored token', async ({ token, authorization }) => {
    storeToken(token);
    const sent = recordAuthorization();

    await api.videos.getVideo({ params: { id: VIDEO_ID } });

    expect(sent).toEqual([authorization]);
  });
});
