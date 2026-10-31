import { screen, within } from '@testing-library/react';

import { featuredApi, libraryOf } from '#app/features/channel/__tests__/featured-api.fixture';
import { renderCustomization } from '#app/features/channel/__tests__/render-customization';
import { stubRowGeometry } from '#app/features/channel/__tests__/row-geometry';

const [FIRST, SECOND, THIRD] = libraryOf(3);

const pinsList = () => screen.getByRole('list', { name: 'Pinned videos' });
const titles = () =>
  within(pinsList())
    .getAllByRole('listitem')
    .map((row) => row.getAttribute('aria-label'));

async function renderPins() {
  const api = featuredApi({
    library: libraryOf(3),
    pinned: [FIRST, SECOND, THIRD].flatMap((video) => video ?? []),
  });
  const rendered = await renderCustomization({}, api.handlers);
  await screen.findByRole('list', { name: 'Pinned videos' });
  return { ...rendered, ...api };
}

describe('apps/client/studio: Start here pins', () => {
  beforeEach(stubRowGeometry);

  it('lists the pins in the order viewers see them, numbered', async () => {
    await renderPins();

    expect(titles()).toEqual(['Video 1', 'Video 2', 'Video 3']);
    expect(
      within(pinsList())
        .getAllByText(/^[123]$/)
        .map((place) => place.textContent)
    ).toEqual(['1', '2', '3']);
  });

  it('moves a pin down with the keyboard and announces it', async () => {
    const { user } = await renderPins();

    await user.click(within(pinsList()).getByRole('button', { name: 'Reorder Video 1' }));
    await user.keyboard('[Space]{ArrowDown}');
    expect(await screen.findByText('Moved to position 2')).toBeInTheDocument();
    await user.keyboard('[Space]');

    expect(titles()).toEqual(['Video 2', 'Video 1', 'Video 3']);
  });

  it('removes a pin by its own button', async () => {
    const { user } = await renderPins();

    await user.click(within(pinsList()).getByRole('button', { name: 'Remove Video 2' }));

    expect(titles()).toEqual(['Video 1', 'Video 3']);
  });
});
