import { exportPlaylist } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import { downloadText } from '#app/features/library/utils/download-text';
import { useExportPlaylist } from '../use-export-playlist';
import { renderWithToasts } from './toast-harness';

vi.mock(import('#app/features/library/utils/download-text'), () => ({ downloadText: vi.fn() }));

describe('apps/client/web: useExportPlaylist', () => {
  it.each([
    { format: 'json', type: 'application/json' },
    { format: 'csv', type: 'text/csv' },
  ] as const)('downloads the $format document under its file name', async ({ format, type }) => {
    apiServer.use(
      mockEndpoint(exportPlaylist, ({ request }) =>
        HttpResponse.json({
          format: new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'json',
          filename: `road-trips.${format}`,
          content: 'the document',
        })
      )
    );
    const { result, show } = renderWithToasts(
      () => useExportPlaylist(uuid(4100)),
      createQueryClient()
    );

    await result.current.mutateAsync(format);

    expect(downloadText).toHaveBeenCalledWith('the document', `road-trips.${format}`, type);
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ title: `Saved road-trips.${format}` })
    );
  });
});
