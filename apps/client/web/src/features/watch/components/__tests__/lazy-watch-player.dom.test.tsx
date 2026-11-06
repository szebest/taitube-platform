import { screen } from '@testing-library/react';

import { renderWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: the lazy watch player', () => {
  it('loads the watch player behind the stage and plays the video in it', async () => {
    await renderWatch();

    expect(screen.getByTestId('player')).toBeInTheDocument();
  });
});
