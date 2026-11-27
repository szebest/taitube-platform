import { screen, waitFor } from '@testing-library/react';
import { updateCreatorVideo } from '@vp/api-contracts';
import { account, mockEndpoint, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderPanel } from '#app/features/creator-stats/__tests__/render-panel';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: CommentsAction', () => {
  it.each([
    { from: true, to: false },
    { from: false, to: true },
  ])('turns comments from  to  over the studio request', async ({ from, to }) => {
    const bodies: unknown[] = [];
    const { user } = await renderPanel({
      viewer: account(),
      video: { commentsEnabled: from },
      handlers: [
        mockEndpoint(updateCreatorVideo, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json(video({ commentsEnabled: to, version: 4 }));
        }),
      ],
    });

    const toggle = await screen.findByRole('switch', { name: 'Comments on' });
    expect(toggle).toHaveAttribute('aria-checked', String(from));
    await user.click(toggle);

    await waitFor(() => expect(bodies).toEqual([{ commentsEnabled: to, version: 3 }]));
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Comments on' })).toHaveAttribute(
        'aria-checked',
        String(to)
      )
    );
  });
});
