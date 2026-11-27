import { screen } from '@testing-library/react';
import { exportPlaylist } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail } from '#app/__tests__/library-fixtures';
import { renderLibrary } from '#app/features/library/__tests__/render-library';
import { LIST, VIDEOS } from '#app/features/library/__tests__/render-playlist';
import { LazyPlaylistImportDialog } from '#app/features/library/components/playlist-import-dialog/playlist-import-dialog.lazy';
import { downloadText } from '#app/features/library/utils/download-text';

vi.mock(import('#app/features/library/utils/download-text'), () => ({ downloadText: vi.fn() }));

describe('apps/client/web: exporting a playlist', () => {
  beforeAll(() => LazyPlaylistImportDialog.preload());

  it('asks for the picked format and downloads the document under its name', async () => {
    const formats: (string | null)[] = [];
    const { user } = await renderLibrary(
      `/playlist?list=${LIST}&modal=playlist-import&direction=export`,
      {
        details: [playlistDetail(LIST, VIDEOS)],
        handlers: [
          mockEndpoint(exportPlaylist, ({ request }) => {
            formats.push(new URL(request.url).searchParams.get('format'));
            return HttpResponse.json({
              format: 'csv',
              filename: 'road-trips.csv',
              content: 'videoId\n',
            });
          }),
        ],
      }
    );

    await user.click(await screen.findByRole('button', { name: 'Download CSV' }));

    expect(await screen.findByText('Saved road-trips.csv')).toBeInTheDocument();
    expect(formats).toEqual(['csv']);
    expect(downloadText).toHaveBeenCalledWith('videoId\n', 'road-trips.csv', 'text/csv');
  });
});
