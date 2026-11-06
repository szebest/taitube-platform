import { screen, waitFor, within } from '@testing-library/react';
import { api, CHANNEL_ID } from '@vp/web-testing';
import { featuredApi, libraryOf } from '#app/features/channel/__tests__/featured-api.fixture';
import { renderCustomization } from '#app/features/channel/__tests__/render-customization';
import { stubRowGeometry } from '#app/features/channel/__tests__/row-geometry';
import { featuredQueryOptions } from '#app/features/channel/api/channel-featured';

const LIBRARY = libraryOf(7);

const section = () => screen.getByRole('form', { name: 'Start here' });
const save = () => within(section()).getByRole('button', { name: 'Save' });
const pinTitles = () =>
  within(screen.getByRole('list', { name: 'Pinned videos' }))
    .getAllByRole('listitem')
    .map((row) => row.getAttribute('aria-label'));

async function renderSection(options: Parameters<typeof featuredApi>[0] = {}) {
  const api = featuredApi({ library: LIBRARY, ...options });
  const rendered = await renderCustomization({}, api.handlers);
  await screen.findByRole('form', { name: 'Start here' });
  return { ...rendered, ...api };
}

async function pin(user: Awaited<ReturnType<typeof renderSection>>['user'], ...titles: string[]) {
  for (const title of titles) {
    await user.click(within(section()).getByRole('button', { name: 'Add videos' }));
    await user.click(await screen.findByRole('option', { name: title }));
    await user.keyboard('{Escape}');
  }
}

describe('apps/client/studio: Start here section', () => {
  beforeEach(stubRowGeometry);

  it('says viewers see the most-watched videos while nothing is pinned, and offers no save', async () => {
    await renderSection();

    expect(
      within(section()).getByText('Viewers see your most-watched videos until you pin some')
    ).toBeInTheDocument();
    expect(within(section()).queryByRole('list', { name: 'Pinned videos' })).toBeNull();
    expect(save()).toBeDisabled();
  });

  it('shows the pins the shelf has, with a preview of the shelf under the heading Start here', async () => {
    await renderSection({ pinned: LIBRARY.slice(0, 2) });

    expect(pinTitles()).toEqual(['Video 1', 'Video 2']);
    const shelf = within(section()).getByRole('region', { name: 'Start here' });
    expect(within(shelf).getAllByRole('listitem')).toHaveLength(2);
    expect(within(shelf).getByRole('link', { name: 'View your channel' })).toHaveAttribute(
      'href',
      expect.stringContaining(`/channel/${CHANNEL_ID}`)
    );
  });

  it('pins three videos, reorders them by keyboard and saves them in that order', async () => {
    const { user, saved } = await renderSection();

    await pin(user, 'Video 1', 'Video 2', 'Video 3');
    await user.click(within(section()).getByRole('button', { name: 'Reorder Video 3' }));
    await user.keyboard('[Space]{ArrowUp}{ArrowUp}[Space]');
    expect(pinTitles()).toEqual(['Video 3', 'Video 1', 'Video 2']);
    await user.click(save());

    expect(await screen.findByText('Start here saved')).toBeInTheDocument();
    expect(saved).toEqual([[LIBRARY[2]?.id, LIBRARY[0]?.id, LIBRARY[1]?.id]]);
    await waitFor(() => expect(save()).toBeDisabled());
    expect(within(section()).getByText('Saved')).toBeInTheDocument();
  });

  it('returns to the fallback note once every pin is removed and saved', async () => {
    const { user, saved } = await renderSection({ pinned: LIBRARY.slice(0, 1) });

    await user.click(within(section()).getByRole('button', { name: 'Remove Video 1' }));
    await user.click(save());

    expect(await screen.findByText('Start here saved')).toBeInTheDocument();
    expect(saved).toEqual([[]]);
    expect(
      within(section()).getByText('Viewers see your most-watched videos until you pin some')
    ).toBeInTheDocument();
  });

  it('stops at six: the picker is disabled and says why, and a removal frees it', async () => {
    const { user } = await renderSection({ pinned: LIBRARY.slice(0, 6) });

    expect(within(section()).getByRole('button', { name: 'Add videos' })).toBeDisabled();
    expect(
      within(section()).getByText(/6 videos are pinned, the most a shelf holds/)
    ).toBeInTheDocument();

    await user.click(within(section()).getByRole('button', { name: 'Remove Video 6' }));

    expect(within(section()).getByRole('button', { name: 'Add videos' })).toBeEnabled();
  });

  it('puts the shelf in the cache at once and puts it back, with the presented error, when the API refuses', async () => {
    const { user, queryClient, saved } = await renderSection({
      pinned: LIBRARY.slice(0, 1),
      refuses: 'FORBIDDEN',
    });
    await pin(user, 'Video 2');

    await user.click(save());

    expect(await screen.findByText('Start here was not saved')).toBeInTheDocument();
    expect(screen.getByText(/not allowed/i)).toBeInTheDocument();
    expect(saved).toEqual([[LIBRARY[0]?.id, LIBRARY[1]?.id]]);
    expect(queryClient.getQueryData(featuredQueryOptions(api, CHANNEL_ID).queryKey)).toMatchObject({
      source: 'pinned',
      items: [{ id: LIBRARY[0]?.id }],
    });
    expect(save()).toBeEnabled();
    expect(pinTitles()).toEqual(['Video 1', 'Video 2']);
  });
});
