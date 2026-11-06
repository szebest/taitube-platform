import { getPlaylist } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { SESSION } from '#app/__tests__/providers';
import {
  libraryVideo,
  playlistDetail,
  uuid,
} from '#app/features/library/__tests__/library-fixtures';
import { getRouter } from '#app/router';

const LIST = uuid(4100);

describe('apps/client/web: /playlist', () => {
  it('server-renders the playlist of the list it is asked for', async () => {
    const { status, main } = await serverRender(getRouter, `/playlist?list=${LIST}`, {
      handlers: [
        mockEndpoint(getPlaylist, () =>
          HttpResponse.json(
            playlistDetail(LIST, [libraryVideo(1, 'Tram ride')], { visibility: 'public' })
          )
        ),
        ...loaderApi(),
      ],
      headers: { cookie: SESSION },
    });

    expect(status).toBe(200);
    expect(main).toContain('>Road trips</h1>');
    expect(main).toContain('>Tram ride</a>');
  });

  it('answers a list that is not an id with not found', async () => {
    const { status } = await serverRender(getRouter, '/playlist?list=nope', {
      handlers: loaderApi(),
    });

    expect(status).toBe(404);
  });
});
