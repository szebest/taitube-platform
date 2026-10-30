import { screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { renderShorts } from '#app/features/shorts/__tests__/render-shorts';
import { SHORTS } from '#app/features/shorts/__tests__/short-fixtures';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/shorts/__tests__/stub-short-player')).StubShortPlayer,
}));

const preloaded = () =>
  [...document.querySelectorAll('link[rel="preload"][as="image"]')].map((link) =>
    link.getAttribute('href')
  );

describe('apps/client/web: ShortsPage', () => {
  it('shows its empty state as the page heading, with the way back to the home feed', async () => {
    await renderShorts({ shorts: [] });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Shorts will appear here' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse videos' })).toHaveAttribute('href', '/');
    expect(await axeViolations()).toEqual([]);
  });

  it('preloads the posters of the next two Shorts, and no others', async () => {
    await renderShorts({ path: `/shorts/${SHORTS[1]?.id}` });

    expect(preloaded()).toEqual([SHORTS[2]?.posterUrl, SHORTS[3]?.posterUrl]);
  });

  it('has no accessibility violations with a Short on screen', async () => {
    await renderShorts();

    expect(await axeViolations()).toEqual([]);
  });
});
