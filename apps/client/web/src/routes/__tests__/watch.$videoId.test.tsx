import { hashKey } from '@tanstack/react-query';
import { getChannel, getRelatedVideos, getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { videoQueryOptions } from '@vp/queries';
import {
  api,
  CHANNEL_ID,
  channel,
  mockEndpoint,
  problemReply,
  VIDEO_ID,
  video,
  videoSummary,
} from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import { headOf, jsonLdOf } from '#app/__tests__/head-tags';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { relatedQueryOptions } from '#app/features/watch/api/related-queries';
import { getRouter } from '#app/router';

const CHANNEL_CARD = {
  id: CHANNEL_ID,
  handle: 'creator',
  displayName: 'The Creator',
  avatarUrl: null,
};

const channelAnswer = mockEndpoint(getChannel, () =>
  HttpResponse.json(channel({ subscriberCount: 284_000 }))
);

const relatedAnswer = mockEndpoint(getRelatedVideos, () =>
  HttpResponse.json({
    items: [
      {
        ...videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000a009', title: 'Tram ride' }),
        reason: { kind: 'co-watched' as const },
      },
    ],
  })
);

function videoAnswer(asked: string[] = []) {
  return mockEndpoint(getVideo, ({ params }) => {
    asked.push(String(params.id));
    return HttpResponse.json(
      video({
        title: 'Launch day',
        description: 'Shot entirely on a Hi8 camcorder.',
        channel: CHANNEL_CARD,
        posterUrl: 'http://localhost:9000/posters/p.jpg',
        playbackUrl: 'http://localhost:9000/hls/master.m3u8',
      })
    );
  });
}

describe('apps/client/web: /watch/$videoId', () => {
  it('server-renders the title, the channel and the description, with the poster standing in for the player', async () => {
    const asked: string[] = [];

    const { status, html } = await serverRender(getRouter, `/watch/${VIDEO_ID}`, {
      handlers: [videoAnswer(asked), channelAnswer, relatedAnswer],
    });

    expect(status).toBe(200);
    expect(html).toContain('<title>Launch day</title>');
    expect(html).toMatch(/<h1[^>]*>Launch day<\/h1>/);
    expect(html).toContain('The Creator');
    expect(html).toContain('284K subscribers');
    expect(html).toContain('Shot entirely on a Hi8 camcorder.');
    expect(html).toContain('src="http://localhost:9000/posters/p.jpg"');
    expect(html).not.toContain('<video');
    expect(html).toContain('Tram ride');
    expect(asked).toEqual([VIDEO_ID]);
  });

  it('server-renders the OpenGraph tags, the Twitter player card and the VideoObject, with one video request', async () => {
    const asked: string[] = [];

    const { html } = await serverRender(getRouter, `/watch/${VIDEO_ID}`, {
      handlers: [videoAnswer(asked), channelAnswer, relatedAnswer],
    });

    const head = headOf(html);
    expect(head).toContain('<meta property="og:type" content="video.other">');
    expect(head).toContain('<meta property="og:title" content="Launch day">');
    expect(head).toContain(
      '<meta property="og:image" content="http://localhost:9000/posters/p.jpg">'
    );
    expect(head).toContain(
      `<meta property="og:video" content="http://localhost:5173/embed/${VIDEO_ID}">`
    );
    expect(head).toContain('<meta property="og:video:type" content="text/html">');
    expect(head).toContain('<meta name="twitter:card" content="player">');
    expect(head).toContain(
      `<meta name="twitter:player" content="http://localhost:5173/embed/${VIDEO_ID}">`
    );
    expect(head).toContain('<meta name="twitter:player:width" content="1280">');
    expect(head).toContain(
      `<link rel="alternate" type="application/json+oembed" href="http://localhost:5173/api/v1/oembed?url=${encodeURIComponent(`http://localhost:5173/watch/${VIDEO_ID}`)}&amp;format=json" title="Launch day">`
    );
    expect(head).toContain(`<link rel="canonical" href="http://localhost:5173/watch/${VIDEO_ID}">`);
    expect(jsonLdOf(html)).toMatchObject([
      { '@context': 'https://schema.org', '@type': 'VideoObject', name: 'Launch day' },
    ]);
    expect(asked).toEqual([VIDEO_ID]);
  });

  it.each([
    { scenario: 'a start time', search: '?t=90', status: 200, location: null },
    {
      scenario: 'a start time that is no number',
      search: '?t=soon',
      status: 307,
      location: `/watch/${VIDEO_ID}`,
    },
  ])('answers $scenario with $status', async ({ search, status, location }) => {
    const rendered = await serverRender(getRouter, `/watch/${VIDEO_ID}${search}`, {
      handlers: [videoAnswer(), channelAnswer, relatedAnswer],
    });

    expect(rendered.status).toBe(status);
    expect(rendered.location).toBe(location);
  });

  it.each([
    { name: 'video', queryKey: videoQueryOptions(api, VIDEO_ID).queryKey },
    { name: 'channel', queryKey: channelQueryOptions(api, CHANNEL_ID).queryKey },
    { name: 'related videos', queryKey: relatedQueryOptions(api, VIDEO_ID).queryKey },
  ])(
    'dehydrates the loaded $name into the page, so hydration reads it instead of refetching',
    async ({ queryKey }) => {
      const { html } = await serverRender(getRouter, `/watch/${VIDEO_ID}`, {
        handlers: [videoAnswer(), channelAnswer, relatedAnswer],
      });

      expect(html).toContain(`queryHash:${JSON.stringify(hashKey(queryKey))}`);
    }
  );

  it('still renders the page when the related videos cannot be read', async () => {
    const { status, html } = await serverRender(getRouter, `/watch/${VIDEO_ID}`, {
      handlers: [
        videoAnswer(),
        channelAnswer,
        mockEndpoint(getRelatedVideos, () => problemReply(ErrorCodes.INTERNAL)),
      ],
    });

    expect(status).toBe(200);
    expect(html).toMatch(/<h1[^>]*>Launch day<\/h1>/);
  });

  it('renders not-found for an id that is not a video id, without asking the API', async () => {
    const { status, html } = await serverRender(getRouter, '/watch/not-a-video');

    expect(status).toBe(404);
    expect(html).toContain('Page not found');
  });

  it('renders not-found when the API has no such video', async () => {
    const { status, html } = await serverRender(getRouter, `/watch/${VIDEO_ID}`, {
      handlers: [mockEndpoint(getVideo, () => problemReply(ErrorCodes.VIDEO_NOT_FOUND))],
    });

    expect(status).toBe(404);
    expect(html).toContain('Page not found');
    expect(headOf(html)).not.toContain('og:');
    expect(jsonLdOf(html)).toEqual([]);
  });
});
