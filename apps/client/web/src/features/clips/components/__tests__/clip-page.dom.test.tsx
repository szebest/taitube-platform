import { screen } from '@testing-library/react';
import { account, VIDEO_ID } from '@vp/web-testing';

import { viewerAccount } from '#app/features/watch/__tests__/comment-fixtures';
import { renderClip } from '../../__tests__/render-clip';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

const OTHER_ID = '0190c3a0-5e1d-7000-8000-00000000b002';

describe('apps/client/web: clip page', () => {
  it('names the clip and plays its range from the video', async () => {
    await renderClip();

    expect(screen.getByRole('heading', { level: 1, name: 'The best part' })).toBeInTheDocument();
    expect(screen.getByTestId('player')).toHaveAttribute('data-range', '20000-30000');
  });

  it('links to the full video at the second the clip starts', async () => {
    await renderClip({ clip: { startMs: 20_900, endMs: 40_000 } });

    expect(screen.getByRole('link', { name: 'Watch the full video' })).toHaveAttribute(
      'href',
      `/watch/${VIDEO_ID}?t=20`
    );
  });

  it.each([
    { viewer: 'a guest', as: undefined, sees: false },
    { viewer: 'another viewer', as: viewerAccount(OTHER_ID), sees: false },
    { viewer: 'its creator', as: account(), sees: true },
  ])('offers Delete clip to $viewer: $sees', async ({ as, sees }) => {
    await renderClip({ viewer: as });

    expect(screen.queryByRole('button', { name: 'Delete clip' }) !== null).toBe(sees);
  });
});
