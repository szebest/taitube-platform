import { screen } from '@testing-library/react';
import { uuid } from '#app/__tests__/library-fixtures';
import {
  LIST,
  renderPlaylist,
  renderSeries,
} from '#app/features/library/__tests__/render-playlist';

const modes = vi.hoisted(() => ({ set: vi.fn() }));

vi.mock(import('#app/hooks/use-playback-queue'), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    usePlaybackQueue: () => ({ ...original.usePlaybackQueue(), setModes: modes.set }),
  };
});

describe('apps/client/web: the playlist hero', () => {
  it('renders the hero and the videos in order, each linked with its place in the list', async () => {
    await renderPlaylist({ visibility: 'unlisted' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Road trips' })
    ).toBeInTheDocument();
    expect(screen.getByText('Slow ways home')).toBeInTheDocument();
    expect(screen.getByText(/3 videos.*Unlisted/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shuffle' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Old film' })).toHaveAttribute(
      'href',
      `/watch/${uuid(2)}?list=${LIST}&index=1`
    );
  });

  it.each([
    { button: 'Play all', shuffle: false },
    { button: 'Shuffle', shuffle: true },
  ])('turns the queue shuffle mode to $shuffle for $button', async ({ button, shuffle }) => {
    const { user } = await renderPlaylist();

    await user.click(await screen.findByRole('button', { name: button }));

    expect(modes.set).toHaveBeenLastCalledWith({ shuffle, repeat: 'off' });
  });

  it.each([
    { viewer: 'the owner', overrides: {}, shown: true },
    {
      viewer: 'someone else',
      overrides: { ownerId: uuid(9999), visibility: 'public' as const },
      shown: false,
    },
  ])('shows the owner controls to $viewer: $shown', async ({ overrides, shown }) => {
    await renderPlaylist(overrides);

    await screen.findByRole('heading', { level: 1, name: 'Road trips' });

    expect(screen.queryByRole('button', { name: 'Edit details' }) !== null).toBe(shown);
    expect(screen.queryByRole('button', { name: 'Delete playlist' }) !== null).toBe(shown);
    expect(screen.queryAllByRole('button', { name: /^Reorder / }).length > 0).toBe(shown);
  });

  it('continues a series at the next unfinished episode, in the playlist, and sets Play all apart', async () => {
    modes.set.mockClear();
    const { user, router } = await renderSeries([100, 40, null], 2);

    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/watch/${uuid(2)}`));
    expect(router.state.location.search).toMatchObject({ list: LIST, index: '1' });
    expect(modes.set).toHaveBeenLastCalledWith({ shuffle: false, repeat: 'off' });
  });

  it.each([
    {
      name: 'a series everything of which is watched',
      render: () => renderSeries([100, 100, 100], null),
    },
    { name: 'a plain playlist', render: () => renderPlaylist() },
  ])('offers no Continue for $name', async ({ render }) => {
    await render();

    await screen.findByRole('button', { name: 'Play all' });

    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });
});
