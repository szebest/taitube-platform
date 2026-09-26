import { hashKey } from '@tanstack/react-query';
import { getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { HttpResponse } from 'msw';

import { VIDEO_ID, video } from '#app/__tests__/fixtures';
import { mockEndpoint, problemReply } from '#app/__tests__/msw/mock-endpoint';
import { serverRender } from '#app/__tests__/server-render';
import { videoQueryOptions } from '#app/features/watch/api/video-query-options';

describe('apps/web: /watch/$videoId', () => {
  it('server-renders the video title, with the poster standing in for the player', async () => {
    const asked: string[] = [];
    const answer = mockEndpoint(getVideo, ({ params }) => {
      asked.push(String(params.id));
      return HttpResponse.json(
        video({
          title: 'Launch day',
          posterUrl: 'http://localhost:9000/posters/p.jpg',
          playbackUrl: 'http://localhost:9000/hls/master.m3u8',
        })
      );
    });

    const { status, html } = await serverRender(`/watch/${VIDEO_ID}`, { handlers: [answer] });

    expect(status).toBe(200);
    expect(html).toContain('<title>Launch day</title>');
    expect(html).toMatch(/<h4[^>]*>Launch day<\/h4>/);
    expect(html).toContain('src="http://localhost:9000/posters/p.jpg"');
    expect(html).not.toContain('<video');
    expect(asked).toEqual([VIDEO_ID]);
  });

  it('dehydrates the loaded video into the page, so hydration reads it instead of refetching', async () => {
    const queryHash = hashKey(videoQueryOptions(VIDEO_ID).queryKey);

    const { html } = await serverRender(`/watch/${VIDEO_ID}`, {
      handlers: [mockEndpoint(getVideo, () => HttpResponse.json(video()))],
    });

    expect(html).toContain(`queryHash:${JSON.stringify(queryHash)}`);
  });

  it('renders not-found for an id that is not a video id, without asking the API', async () => {
    const { status, html } = await serverRender('/watch/not-a-video');

    expect(status).toBe(404);
    expect(html).toContain('This page does not exist.');
  });

  it('renders not-found when the API has no such video', async () => {
    const { status, html } = await serverRender(`/watch/${VIDEO_ID}`, {
      handlers: [mockEndpoint(getVideo, () => problemReply(ErrorCodes.VIDEO_NOT_FOUND))],
    });

    expect(status).toBe(404);
    expect(html).toContain('This page does not exist.');
  });
});
