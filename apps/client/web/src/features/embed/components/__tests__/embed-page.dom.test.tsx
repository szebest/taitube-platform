import { screen } from '@testing-library/react';
import { getVideo } from '@vp/api-contracts';
import { mockEndpoint, VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { getRouter } from '#app/router';

async function renderEmbed(search = '', overrides: Parameters<typeof video>[0] = {}) {
  const rendered = await renderRoute(getRouter, `/embed/${VIDEO_ID}${search}`, {
    handlers: [
      mockEndpoint(getVideo, () =>
        HttpResponse.json(
          video({
            title: 'Launch day',
            posterUrl: 'http://localhost:9000/posters/p.jpg',
            playbackUrl: 'http://localhost:9000/public/videos/v1/hls/master.m3u8',
            ...overrides,
          })
        )
      ),
    ],
  });
  const player = await screen.findByRole('group', { name: 'Media player' });
  return { ...rendered, player, video: rendered.container.querySelector('video') };
}

describe('apps/client/web: the embed page', () => {
  it('renders the player alone, with no header, sidebar or discussion', async () => {
    await renderEmbed();

    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Player controls' })).toBeInTheDocument();
  });

  it.each([
    { search: '', controls: true, loop: false, muted: false },
    { search: '?controls=0', controls: false, loop: false, muted: false },
    { search: '?loop=1', controls: true, loop: true, muted: false },
    { search: '?autoplay=1', controls: true, loop: false, muted: true },
    { search: '?controls=nope&loop=2&autoplay=maybe', controls: true, loop: false, muted: false },
  ])('reads $search', async ({ search, controls, loop, muted }) => {
    const { video: element } = await renderEmbed(search);

    expect(!!screen.queryByRole('group', { name: 'Player controls' })).toBe(controls);
    expect(element?.loop).toBe(loop);
    expect(element?.muted).toBe(muted);
  });

  it('shows only a not-available note for a video that is not public', async () => {
    await renderRoute(getRouter, `/embed/${VIDEO_ID}`, {
      handlers: [mockEndpoint(getVideo, () => HttpResponse.json(video({ visibility: 'private' })))],
    });

    expect(await screen.findByRole('status')).toHaveTextContent('This video is not available');
    expect(screen.queryByRole('group', { name: 'Media player' })).not.toBeInTheDocument();
  });
});
