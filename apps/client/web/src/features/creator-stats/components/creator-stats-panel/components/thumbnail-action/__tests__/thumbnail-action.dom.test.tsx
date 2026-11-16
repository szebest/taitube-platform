import { screen, waitFor, within } from '@testing-library/react';
import { updateCreatorVideo } from '@vp/api-contracts';
import { account, mockEndpoint, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderPanel } from '#app/features/creator-stats/__tests__/render-panel';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const POSTER = 'http://localhost:9000/public/a/poster.jpg';
const CUSTOM = 'http://localhost:9000/public/a/custom.jpg';

function renderThumbnails(thumbnailUrl: string) {
  const bodies: unknown[] = [];
  const rendered = renderPanel({
    viewer: account(),
    video: { posterUrl: POSTER, thumbnailUrl },
    handlers: [
      mockEndpoint(updateCreatorVideo, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(video({ posterUrl: POSTER, thumbnailUrl: POSTER, version: 4 }));
      }),
    ],
  });
  return { rendered, bodies };
}

describe('apps/client/web: ThumbnailAction', () => {
  it('shows the thumbnail in use and the generated frame, and picks the frame through the studio request', async () => {
    const { rendered, bodies } = renderThumbnails(CUSTOM);
    const { user } = await rendered;

    await user.click(await screen.findByRole('button', { name: 'Thumbnail' }));
    const choices = await screen.findByRole('dialog');
    expect(within(choices).getByText('Current thumbnail')).toBeInTheDocument();
    expect(within(choices).getByText('Generated frame')).toBeInTheDocument();
    await user.click(within(choices).getByRole('button', { name: 'Use this frame' }));

    await waitFor(() =>
      expect(bodies).toEqual([{ selectedThumbnail: { source: 'poster' }, version: 3 }])
    );
  });

  it('offers no frame to pick when the generated one is already the thumbnail', async () => {
    const { rendered } = renderThumbnails(POSTER);
    const { user } = await rendered;

    await user.click(await screen.findByRole('button', { name: 'Thumbnail' }));
    const choices = await screen.findByRole('dialog');

    expect(within(choices).getByText('Current thumbnail')).toBeInTheDocument();
    expect(
      within(choices).queryByRole('button', { name: 'Use this frame' })
    ).not.toBeInTheDocument();
  });
});
