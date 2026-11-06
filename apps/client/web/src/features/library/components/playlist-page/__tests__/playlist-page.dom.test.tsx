import { screen, within } from '@testing-library/react';
import { renderPlaylist, titles } from '#app/features/library/__tests__/render-playlist';

describe('apps/client/web: the playlist page', () => {
  it('shows the hero above the videos in their order', async () => {
    await renderPlaylist();

    const hero = (await screen.findByRole('heading', { level: 1, name: 'Road trips' })).closest(
      'header'
    );

    expect(hero).not.toBeNull();
    expect(within(hero as HTMLElement).getByText('Slow ways home')).toBeInTheDocument();
    expect(titles()).toEqual(['Tram ride', 'Old film', 'Night bus']);
  });
});
