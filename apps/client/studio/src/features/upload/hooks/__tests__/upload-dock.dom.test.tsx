import { screen } from '@testing-library/react';

import { renderStudio, serveUpload, uploadClip } from '#app/features/upload/__tests__/upload-api.fixture';

describe('apps/client/studio: UploadDockProvider', () => {
  it('moves an upload from sending to sent when the file is stored and the API has it', async () => {
    const { finishTransfer } = serveUpload();
    const { user } = await renderStudio();

    await uploadClip(user, 'Harbour');
    expect(await screen.findByText('Uploading Harbour')).toBeInTheDocument();

    finishTransfer();

    expect(await screen.findByRole('progressbar', { name: 'Overall of Harbour' })).toBeInTheDocument();
    expect(screen.queryByText('Uploading Harbour')).not.toBeInTheDocument();
  });

  it('moves it to failed when the storage refuses the file', async () => {
    const { failTransfer, aborts } = serveUpload();
    const { user } = await renderStudio();
    await uploadClip(user, 'Harbour');
    await screen.findByText('Uploading Harbour');

    failTransfer();

    expect(await screen.findByText('Harbour did not upload')).toBeInTheDocument();
    await vi.waitFor(() => expect(aborts).toHaveLength(1));
  });

  it('lets the next file start once the first has been sent', async () => {
    const { finishTransfer } = serveUpload();
    const { user } = await renderStudio();
    await uploadClip(user, 'First');
    finishTransfer();
    await screen.findByRole('progressbar', { name: 'Overall of First' });

    await uploadClip(user, 'Second');

    expect(await screen.findByText('Uploading Second')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Overall of First' })).toBeInTheDocument();
  });
});
