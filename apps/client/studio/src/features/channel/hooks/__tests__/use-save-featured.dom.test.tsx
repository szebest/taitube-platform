import { screen, within } from '@testing-library/react';

import { featuredApi, libraryOf } from '#app/features/channel/__tests__/featured-api.fixture';
import { renderCustomization } from '#app/features/channel/__tests__/render-customization';

const LIBRARY = libraryOf(2);

async function renderRefusedSave() {
  const api = featuredApi({ library: LIBRARY, pinned: LIBRARY.slice(0, 1), refuses: 'FORBIDDEN' });
  const rendered = await renderCustomization({}, api.handlers);
  const section = await screen.findByRole('form', { name: 'Start here' });
  await rendered.user.click(within(section).getByRole('button', { name: 'Remove Video 1' }));
  await rendered.user.click(within(section).getByRole('button', { name: 'Save' }));
  await screen.findByText('Start here was not saved');
  return { ...rendered, ...api };
}

describe('apps/client/studio: useSaveFeatured', () => {
  it('toasts the presented error of a refusal with a way to try again', async () => {
    await renderRefusedSave();

    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('sends the same pins again from the retry', async () => {
    const { user, saved } = await renderRefusedSave();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await vi.waitFor(() => expect(saved).toEqual([[], []]));
  });
});
