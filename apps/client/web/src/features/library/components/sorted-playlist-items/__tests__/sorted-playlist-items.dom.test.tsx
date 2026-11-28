import { screen, within } from '@testing-library/react';
import { listPlaylistItems } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { annotatedPlaylist } from '#app/features/library/__tests__/annotated-playlist';
import { renderLibrary } from '#app/features/library/__tests__/render-library';
import { LIST } from '#app/features/library/__tests__/render-playlist';

/** The playlist sorted by duration, the API answering its videos in reverse. */
const renderSorted = () => {
  const asked: string[] = [];
  const playlist = annotatedPlaylist();
  const rendered = renderLibrary(`/playlist?list=${LIST}&sort=duration`, {
    details: [playlist],
    handlers: [
      mockEndpoint(listPlaylistItems, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('sort') ?? '');
        return HttpResponse.json({ items: playlist.items.toReversed(), nextCursor: null });
      }),
    ],
  });
  return { rendered, asked };
};

describe('apps/client/web: a playlist in a viewing order', () => {
  it('reads the videos in that order and shows them without handles, menus or sections', async () => {
    const { rendered, asked } = renderSorted();
    await rendered;

    const list = await screen.findByRole('list', { name: 'Videos in Road trips' });
    expect(
      within(list)
        .getAllByRole('article')
        .map((card) => within(card).getAllByRole('link')[1]?.textContent)
    ).toEqual(['Night bus', 'Old film', 'Tram ride']);
    expect(asked).toEqual(['duration']);
    expect(within(list).queryByText('Morning')).toBeNull();
    expect(document.querySelector('[data-slot="sortable-list-handle"]')).toBeNull();
    expect(screen.getByText('00:30 to 01:45')).toBeInTheDocument();
  });
});
