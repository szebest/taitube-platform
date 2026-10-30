import { screen } from '@testing-library/react';

import { renderWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: watch page', () => {
  it.each([
    { scenario: 'a titled video', title: 'Launch day', heading: 'Launch day' },
    { scenario: 'an untitled video', title: null, heading: 'Untitled video' },
  ])('heads the page of $scenario with its title', async ({ title, heading }) => {
    await renderWatch({ video: { title } });

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('puts the engagement bar, the notes and the related videos on the page', async () => {
    await renderWatch();

    expect(screen.getByRole('toolbar', { name: 'Video actions' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Description' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'More like this' })).toBeInTheDocument();
  });
});
