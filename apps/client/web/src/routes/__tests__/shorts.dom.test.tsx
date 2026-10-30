import { screen } from '@testing-library/react';

import { renderShorts } from '#app/features/shorts/__tests__/render-shorts';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/shorts/__tests__/stub-short-player')).StubShortPlayer,
}));

describe('apps/client/web: /shorts in the browser', () => {
  it('titles the page and plays the first Short of the feed the loader fetched', async () => {
    await renderShorts();

    expect(document.title).toBe('Shorts - Taitube');
    expect(await screen.findByTestId('player')).toHaveAttribute('data-layout', 'vertical');
  });

  it('keeps the Short the URL names across a move, on the one page', async () => {
    const { router, user } = await renderShorts();
    const frame = screen.getByRole('region', { name: 'Shorts player' });
    screen.getByRole('button', { name: 'Pause' }).focus();

    await user.keyboard('{ArrowDown}');

    await screen.findByText('Short 2', { selector: 'p' });
    expect(screen.getByRole('region', { name: 'Shorts player' })).toBe(frame);
    expect(router.state.location.pathname).toMatch(/^\/shorts\/0190c3a0/);
  });
});
