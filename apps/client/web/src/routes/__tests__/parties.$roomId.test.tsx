import { getWatchParty } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, PARTY_ID, partyPreview, problemReply, VIDEO_ID } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const THUMBNAIL = 'http://localhost:9000/posters/p.jpg';

function renderParty(
  preview: Parameters<typeof partyPreview>[0] = {},
  path = `/parties/${PARTY_ID}`
) {
  const asked: string[] = [];

  return serverRender(getRouter, path, {
    handlers: [
      mockEndpoint(getWatchParty, ({ params, request }) => {
        asked.push(`${params.id}${new URL(request.url).search}`);
        return HttpResponse.json(
          partyPreview({
            currentVideo: {
              id: VIDEO_ID,
              title: 'Big Buck Bunny',
              durationMs: 600_000,
              thumbnailUrl: THUMBNAIL,
            },
            ...preview,
          })
        );
      }),
      ...loaderApi(),
    ],
  }).then((rendered) => ({ ...rendered, asked }));
}

describe('apps/client/web: /parties/$roomId', () => {
  it('server-renders the preview of a room for a visitor with no seat, with its three way-ins', async () => {
    const { status, main, asked } = await renderParty({
      name: 'Movie night',
      viewer: { actions: ['guest', 'discord', 'sign_in'] },
    });

    expect(status).toBe(200);
    expect(asked).toEqual([PARTY_ID]);
    expect(main).toContain('>Movie night</h1>');
    expect(main).toContain('Watch as guest');
    expect(main).toContain('Sign in');
  });

  it('passes the invite on the link to the preview', async () => {
    const { asked } = await renderParty({}, `/parties/${PARTY_ID}?invite=inv-1`);

    expect(asked).toEqual([`${PARTY_ID}?invite=inv-1`]);
  });

  it('is noindex, and a public room unfurls with its name and thumbnail', async () => {
    const { html } = await renderParty({ name: 'Movie night', visibility: 'public' });

    expect(html).toContain('<meta name="robots" content="noindex, nofollow"');
    expect(html).toContain('<title>Movie night - watch party');
    expect(html).toContain(`<meta property="og:image" content="${THUMBNAIL}"`);
  });

  it('gives a private room the generic invitation with no name and no image', async () => {
    const { html } = await renderParty({ name: 'Secret club', visibility: 'private' });

    expect(html).toContain('<title>Join a watch party on Taitube');
    expect(html).not.toContain('og:image');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"');
  });

  it.each([
    { scenario: 'a room the API does not find', path: `/parties/${PARTY_ID}` },
    { scenario: 'an id that is not a room id', path: '/parties/not-an-id' },
  ])('renders not found for $scenario', async ({ path }) => {
    const { status } = await serverRender(getRouter, path, {
      handlers: [
        mockEndpoint(getWatchParty, () => problemReply(ErrorCodes.WATCH_PARTY_NOT_FOUND)),
        ...loaderApi(),
      ],
    });

    expect(status).toBe(404);
  });
});
