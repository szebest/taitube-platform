import { screen, within } from '@testing-library/react';
import { mergePlaylists } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { ownedPlaylist, playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { renderLibrary } from '#app/features/library/__tests__/render-library';
import { LIST, VIDEOS } from '#app/features/library/__tests__/render-playlist';
import { LazyPlaylistMergeDialog } from '../playlist-merge-dialog.lazy';

const SOURCES = [ownedPlaylist(1, { title: 'Spring' }), ownedPlaylist(2, { title: 'Summer' })];

describe('apps/client/web: merging playlists', () => {
  beforeAll(() => LazyPlaylistMergeDialog.preload());

  it.each([
    { target: 'This playlist', newTitle: null, body: { into: LIST } },
    { target: 'A new playlist', newTitle: 'Whole year', body: { newTitle: 'Whole year' } },
  ])(
    'merges the picked playlists into $target and reports the items',
    async ({ target, newTitle, body }) => {
      const bodies: unknown[] = [];
      const { user } = await renderLibrary(`/playlist?list=${LIST}&modal=playlist-merge`, {
        playlists: SOURCES,
        details: [playlistDetail(LIST, VIDEOS)],
        handlers: [
          mockEndpoint(mergePlaylists, async ({ request }) => {
            bodies.push(await request.clone().json());
            return HttpResponse.json({
              playlistId: LIST,
              results: [{ itemId: uuid(7000), ok: true, duplicate: false }],
            });
          }),
        ],
      });

      const dialog = within(await screen.findByRole('dialog', { name: 'Merge playlists' }));
      await user.click(await dialog.findByRole('checkbox', { name: 'Spring' }));
      await user.click(dialog.getByRole('checkbox', { name: 'Summer' }));
      await user.click(dialog.getByRole('radio', { name: target }));
      if (newTitle !== null) {
        await user.type(
          dialog.getByRole('textbox', { name: 'Title of the new playlist' }),
          newTitle
        );
      }
      await user.click(
        dialog.getByRole('switch', { name: 'Delete the merged playlists afterwards' })
      );
      await user.click(dialog.getByRole('button', { name: 'Merge' }));

      expect(await dialog.findByText('Merged: 1')).toBeInTheDocument();
      expect(bodies).toEqual([
        { sourceIds: SOURCES.map(({ id }) => id), deleteSources: true, ...body },
      ]);
    }
  );
});
