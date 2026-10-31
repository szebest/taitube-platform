import { screen, within } from '@testing-library/react';

import { featuredApi, libraryOf } from '#app/features/channel/__tests__/featured-api.fixture';
import { renderCustomization } from '#app/features/channel/__tests__/render-customization';

async function renderPreview(count: number) {
  const library = libraryOf(3);
  const api = featuredApi({ library, pinned: library.slice(0, count) });
  const rendered = await renderCustomization({}, api.handlers);
  await screen.findByRole('form', { name: 'Start here' });
  return rendered;
}

const preview = () => screen.queryByRole('region', { name: 'Start here' });

describe('apps/client/studio: Start here preview', () => {
  it('draws the pins as the channel page does: titled, numbered and attributed to the creator', async () => {
    await renderPreview(2);

    const shelf = within(preview() as HTMLElement);
    expect(shelf.getAllByRole('listitem').map((card) => card.textContent)).toEqual([
      expect.stringContaining('Video 1'),
      expect.stringContaining('Video 2'),
    ]);
    expect(shelf.getByText('Pinned by creator')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="start-here-shelf-position"]')).toHaveLength(2);
  });

  it('follows a removal at once, and is gone with the last pin', async () => {
    const { user } = await renderPreview(1);

    await user.click(screen.getByRole('button', { name: 'Remove Video 1' }));

    expect(preview()).toBeNull();
  });
});
