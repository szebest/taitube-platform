import { screen } from '@testing-library/react';
import { uuid } from '#app/features/library/__tests__/library-fixtures';
import { LIST, renderPlaylist } from '#app/features/library/__tests__/render-playlist';

const modes = vi.hoisted(() => ({ set: vi.fn() }));

vi.mock(import('#app/features/watch/hooks/use-playback-queue'), async (importOriginal) => {
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
});
