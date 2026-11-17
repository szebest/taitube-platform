import { screen } from '@testing-library/react';
import { CHANNEL_ID } from '@vp/web-testing';
import { streamUserEvents } from '@vp/web-testing/dom';
import { dataExport, EXPORT_ID } from '#app/features/developers/__tests__/developers-api.fixture';
import { renderDevelopers } from '#app/features/developers/__tests__/render-developers';

describe('apps/client/studio: useExportEvents', () => {
  it('says an export failed and reloads the table with the reason', async () => {
    const stream = streamUserEvents();
    const { state } = await renderDevelopers({ exports: [dataExport()] });
    await screen.findByText('Writing');

    state.exports = [dataExport({ status: 'failed', failure: 'EXPORT_TOO_LARGE' })];
    stream.send({
      type: 'export.failed',
      payload: {
        exportId: EXPORT_ID,
        channelId: CHANNEL_ID,
        kind: 'comments',
        reason: 'EXPORT_TOO_LARGE',
      },
    });

    expect(await screen.findByText('Your Comments export failed')).toBeInTheDocument();
    expect(await screen.findByText('EXPORT_TOO_LARGE')).toBeInTheDocument();
  });
});
