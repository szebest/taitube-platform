import { screen, within } from '@testing-library/react';

import { featuredApi, libraryOf } from '#app/features/channel/__tests__/featured-api.fixture';
import { renderCustomization } from '#app/features/channel/__tests__/render-customization';

const open = async (user: Awaited<ReturnType<typeof renderCustomization>>['user']) => {
  await user.click(screen.getByRole('button', { name: 'Add videos' }));
  return screen.findByRole('combobox');
};

async function renderPicker(options: Parameters<typeof featuredApi>[0]) {
  const api = featuredApi(options);
  const rendered = await renderCustomization({}, api.handlers);
  await screen.findByRole('button', { name: 'Add videos' });
  return { ...rendered, ...api };
}

describe('apps/client/studio: Start here picker', () => {
  it('lists the public ready videos that are not pinned yet, and narrows them by title', async () => {
    const library = libraryOf(3);
    const { user } = await renderPicker({ library, pinned: library.slice(0, 1) });

    const search = await open(user);
    const choices = await screen.findAllByRole('option');
    expect(choices.map((choice) => choice.textContent)).toEqual(['Video 2', 'Video 3']);

    await user.type(search, 'Video 3');

    expect(screen.getAllByRole('option').map((choice) => choice.textContent)).toEqual(['Video 3']);
  });

  it('says so when nothing is left to pin', async () => {
    const { user } = await renderPicker({ library: [] });

    await open(user);

    expect(await screen.findByText('No public, ready video left to pin.')).toBeInTheDocument();
  });

  it('pins the chosen video at the end of the list', async () => {
    const { user } = await renderPicker({ library: libraryOf(2) });

    await open(user);
    await user.click(await screen.findByRole('option', { name: 'Video 2' }));

    const pins = await screen.findByRole('list', { name: 'Pinned videos' });
    expect(within(pins).getAllByRole('listitem')).toHaveLength(1);
    expect(within(pins).getByText('Video 2')).toBeInTheDocument();
  });

  it('asks for the next page of videos on request', async () => {
    const { user } = await renderPicker({ library: libraryOf(3), pageSize: 2 });

    await open(user);
    expect(await screen.findAllByRole('option')).toHaveLength(3);
    await user.click(screen.getByRole('option', { name: 'Show more videos' }));

    expect(await screen.findByRole('option', { name: 'Video 3' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Show more videos' })).toBeNull();
  });

  it('is disabled while six videos are pinned', async () => {
    const library = libraryOf(7);
    await renderPicker({ library, pinned: library.slice(0, 6) });

    expect(screen.getByRole('button', { name: 'Add videos' })).toBeDisabled();
  });
});
