import { getPlaylist, getVideo } from '@vp/api-contracts';
import { mockEndpoint, VIDEO_ID, video, videoSummary } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const LIST = uuid(4100);
const PLAYLIST = playlistDetail(LIST, [
  videoSummary({ id: VIDEO_ID, title: 'Launch day' }),
  videoSummary({ id: uuid(6010), title: 'Queued one' }),
  videoSummary({ id: uuid(6011), title: 'Queued two' }),
]);

const render = (search: string) =>
  serverRender(getRouter, `/watch/${VIDEO_ID}${search}`, {
    handlers: [
      mockEndpoint(getVideo, () => HttpResponse.json(video({ title: 'Launch day' }))),
      mockEndpoint(getPlaylist, () => HttpResponse.json(PLAYLIST)),
      ...loaderApi(),
    ],
  });

describe('apps/client/web: watch queue on the server', () => {
  it.each([
    { scenario: 'a video opened alone', search: '', position: '1 / 1' },
    {
      scenario: 'a video opened from a playlist',
      search: `?list=${LIST}&index=0`,
      position: '1 / 3',
    },
  ])(
    'renders the queue the page opens for $scenario, so hydration does not swap it',
    async ({ search, position }) => {
      const { status, main } = await render(search);

      expect(status).toBe(200);
      expect(main).toContain('Now playing');
      expect(main).toContain(position);
      expect(main).not.toContain('Nothing queued');
    }
  );
});
