import { screen, within } from '@testing-library/react';
import { VIDEO_ID } from '@vp/web-testing';

import { UPLOAD_ID, renderStudio, serveUpload, uploadClip } from '#app/features/upload/__tests__/upload-api.fixture';

const widget = () => screen.findByRole('complementary', { name: 'Uploads' });

describe('apps/client/studio: UploadWidget', () => {
  it('shows nothing until an upload starts', async () => {
    await renderStudio();

    expect(screen.queryByRole('complementary', { name: 'Uploads' })).not.toBeInTheDocument();
  });

  it('shows the bytes sent so far on a progress bar named for the upload', async () => {
    const { finishTransfer } = serveUpload();
    const { user } = await renderStudio();

    await uploadClip(user, 'Harbour');

    const bar = await screen.findByRole('progressbar', { name: 'Upload progress of Harbour' });
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(await widget()).toHaveTextContent('50% · 4 byte / 8 byte');
    finishTransfer();
    await screen.findByRole('progressbar', { name: 'Overall of Harbour' });
  });

  it('keeps showing it while the creator moves to another studio page', async () => {
    const { finishTransfer } = serveUpload();
    const { user, router } = await renderStudio();
    await uploadClip(user, 'Harbour');
    await screen.findByRole('progressbar', { name: 'Upload progress of Harbour' });

    await router.navigate({ to: '/videos/$videoId/edit', params: { videoId: VIDEO_ID } });

    expect(await screen.findByRole('heading', { name: /Editing video/ })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Upload progress of Harbour' })).toBeInTheDocument();
    finishTransfer();
    await screen.findByRole('progressbar', { name: 'Overall of Harbour' });
  });

  it('cancels the transfer, aborts the upload and takes the row away', async () => {
    const { aborts } = serveUpload();
    const { user } = await renderStudio();
    await uploadClip(user, 'Harbour');

    await user.click(await screen.findByRole('button', { name: 'Cancel the upload of Harbour' }));

    await vi.waitFor(() => expect(aborts).toEqual([UPLOAD_ID]));
    expect(screen.queryByRole('complementary', { name: 'Uploads' })).not.toBeInTheDocument();
  });

  it('says which upload failed, and lets the creator dismiss it', async () => {
    serveUpload({ startRefused: true });
    const { user } = await renderStudio();

    await uploadClip(user, 'Harbour');

    const alert = await within(await widget()).findByRole('alert');
    expect(alert).toHaveTextContent('Harbour did not upload');
    await user.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('complementary', { name: 'Uploads' })).not.toBeInTheDocument();
  });

  it('follows a sent upload into its processing and lets the creator dismiss it', async () => {
    const { finishTransfer } = serveUpload();
    const { user } = await renderStudio();
    await uploadClip(user, 'Harbour');
    await screen.findByRole('progressbar', { name: 'Upload progress of Harbour' });

    finishTransfer();

    expect(await screen.findByRole('progressbar', { name: 'Overall of Harbour' })).toBeInTheDocument();
    await user.click(within(await widget()).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('complementary', { name: 'Uploads' })).not.toBeInTheDocument();
  });
});
