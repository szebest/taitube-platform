import { screen, waitFor, within } from '@testing-library/react';
import { importPlaylist } from '@vp/api-contracts';
import { PLAYLIST_IMPORT_MAX_LINES } from '@vp/domain';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { renderLibrary } from '#app/features/library/__tests__/render-library';
import { LIST, VIDEOS } from '#app/features/library/__tests__/render-playlist';
import { LazyPlaylistImportDialog } from '#app/features/library/components/playlist-import-dialog/playlist-import-dialog.lazy';

/** The Import tab open, the API answering each pasted line with the statuses given in turn. */
const renderImport = async () => {
  const bodies: unknown[] = [];
  const rendered = await renderLibrary(
    `/playlist?list=${LIST}&modal=playlist-import&direction=import`,
    {
      details: [playlistDetail(LIST, VIDEOS)],
      handlers: [
        mockEndpoint(importPlaylist, async ({ request }) => {
          bodies.push(await request.clone().json());
          return HttpResponse.json({
            lines: [
              { line: 1, status: 'added', videoId: uuid(1) },
              { line: 2, status: 'duplicate', videoId: uuid(2) },
              { line: 3, status: 'not_found', videoId: null },
              { line: 4, status: 'unrecognised', videoId: null },
            ],
          });
        }),
      ],
    }
  );
  const dialog = within(await screen.findByRole('dialog', { name: 'Import and export' }));
  return { ...rendered, dialog, bodies };
};

describe('apps/client/web: importing into a playlist', () => {
  beforeAll(() => LazyPlaylistImportDialog.preload());

  it('sends the pasted links and lists each line with its result and the counts', async () => {
    const { user, dialog, bodies } = await renderImport();
    const content = `${uuid(1)}\n${uuid(2)}\n${uuid(3)}\nhttps://elsewhere.example/v/1`;

    await user.click(dialog.getByRole('textbox', { name: 'What to import' }));
    await user.paste(content);
    await user.click(dialog.getByRole('button', { name: 'Import' }));

    const results = within(await dialog.findByRole('region', { name: 'Import results' }));
    expect(results.getByText('Added: 1')).toBeInTheDocument();
    expect(results.getByText('Not a video of this site: 1')).toBeInTheDocument();
    expect(
      results
        .getAllByRole('listitem')
        .slice(4)
        .map(({ textContent }) => textContent)
    ).toEqual([
      'Line 1: Added',
      'Line 2: Already in the playlist',
      'Line 3: No such video',
      'Line 4: Not a video of this site',
    ]);
    expect(bodies).toEqual([{ format: 'urls', content }]);
  });

  it('takes the format from a picked file and its text', async () => {
    const { user, dialog, bodies } = await renderImport();

    await user.upload(
      dialog.getByLabelText('Or choose a file'),
      new File(['videoId\n1'], 'trips.csv', { type: 'text/csv' })
    );
    await waitFor(() =>
      expect(dialog.getByRole('textbox', { name: 'What to import' })).toHaveValue('videoId\n1')
    );
    await user.click(dialog.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(bodies).toEqual([{ format: 'csv', content: 'videoId\n1' }]));
  });

  it('refuses too many lines before sending anything', async () => {
    const { user, dialog, bodies } = await renderImport();

    await user.click(dialog.getByRole('textbox', { name: 'What to import' }));
    await user.paste(Array.from({ length: PLAYLIST_IMPORT_MAX_LINES + 1 }, () => 'x').join('\n'));
    await user.click(dialog.getByRole('button', { name: 'Import' }));

    expect(
      await dialog.findByText('That has 501 lines; at most 500 go in at once')
    ).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });
});
