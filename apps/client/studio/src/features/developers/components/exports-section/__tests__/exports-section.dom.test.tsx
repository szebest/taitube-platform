import { screen, within } from '@testing-library/react';
import { CHANNEL_ID } from '@vp/web-testing';
import { streamUserEvents } from '@vp/web-testing/dom';
import {
  dataExport,
  DOWNLOAD_URL,
  EXPORT_ID,
} from '#app/features/developers/__tests__/developers-api.fixture';
import { renderDevelopers } from '#app/features/developers/__tests__/render-developers';

const exports = () => screen.getByRole('region', { name: 'Exports' });
const statusOf = async (kind: string) =>
  within((await within(exports()).findByText(kind)).closest('tr') as HTMLElement);

describe('apps/client/studio: ExportsSection', () => {
  it('follows a running export to ready on the user stream, then offers its file', async () => {
    const stream = streamUserEvents();
    const { state } = await renderDevelopers({ exports: [dataExport()] });

    const running = await statusOf('Comments');
    expect(running.getByText('Writing')).toBeInTheDocument();
    expect(running.getByRole('progressbar', { name: 'Writing' })).toBeInTheDocument();
    expect(running.queryByRole('button', { name: 'Download the Comments export' })).toBeNull();

    state.exports = [
      dataExport({ status: 'ready', rowCount: 1200, expiresAt: '2026-03-08T12:00:00.000Z' }),
    ];
    stream.send({
      type: 'export.ready',
      payload: {
        exportId: EXPORT_ID,
        channelId: CHANNEL_ID,
        kind: 'comments',
        format: 'csv',
        rowCount: 1200,
        expiresAt: '2026-03-08T12:00:00.000Z',
      },
    });

    expect(await screen.findByText('Your Comments export is ready')).toBeInTheDocument();
    const ready = await statusOf('Comments');
    expect(await ready.findByText('1,200 rows')).toBeInTheDocument();
    expect(ready.getByText('Ready')).toBeInTheDocument();
  });

  it('downloads a ready file through a fresh presigned address', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { user } = await renderDevelopers({
      exports: [dataExport({ status: 'ready', rowCount: 3 })],
    });

    await user.click(
      (await statusOf('Comments')).getByRole('button', { name: 'Download the Comments export' })
    );

    await vi.waitFor(() => expect(open).toHaveBeenCalledWith(DOWNLOAD_URL, '_self'));
  });

  it('deletes an export', async () => {
    const { user, requests } = await renderDevelopers({
      exports: [dataExport({ status: 'failed', failure: 'EXPORT_TOO_LARGE' })],
    });

    await user.click(
      (await statusOf('Comments')).getByRole('button', { name: 'Delete the Comments export' })
    );

    expect(await screen.findByText('Export deleted')).toBeInTheDocument();
    expect(requests.deletedExports).toEqual([EXPORT_ID]);
  });
});
