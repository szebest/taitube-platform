import { fireEvent, screen, within } from '@testing-library/react';

import { CLIP, renderStudio, serveUpload, uploadClip } from '#app/features/upload/__tests__/upload-api.fixture';

const openButton = async () =>
  within(await screen.findByRole('banner')).getByRole('button', { name: 'Upload' });

async function openDialog() {
  const rendered = await renderStudio();
  await rendered.user.click(await openButton());
  const dialog = await screen.findByRole('dialog', { name: 'Upload a video' });
  return { ...rendered, dialog };
}

const submit = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Upload' });

describe('apps/client/studio: UploadDialog', () => {
  it('holds the upload back until a video file is chosen and the title is valid', async () => {
    const { user, dialog } = await openDialog();
    expect(submit(dialog)).toBeDisabled();

    await user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, CLIP);
    expect(submit(dialog)).toBeDisabled();

    await user.type(within(dialog).getByRole('textbox', { name: 'Video title' }), 'Harbour');

    await vi.waitFor(() => expect(submit(dialog)).toBeEnabled());
  });

  it('takes a file dropped on it', async () => {
    const { user, dialog } = await openDialog();
    const dropzone = dialog.querySelector('input[type="file"]')?.parentElement as HTMLElement;

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [CLIP],
        items: [{ kind: 'file', type: CLIP.type, getAsFile: () => CLIP }],
        types: ['Files'],
      },
    });

    expect(await within(dialog).findByText('clip.mp4')).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: 'Video title' }), 'Harbour');
    await vi.waitFor(() => expect(submit(dialog)).toBeEnabled());
  });

  it('does not take a file that is not a video the API accepts', async () => {
    const { user, dialog } = await openDialog();
    await user.type(within(dialog).getByRole('textbox', { name: 'Video title' }), 'Harbour');

    fireEvent.change(dialog.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['x'], 'note.png', { type: 'image/png' })] },
    });

    expect(within(dialog).getByText('Drag a video here, or click to choose a file')).toBeInTheDocument();
    expect(submit(dialog)).toBeDisabled();
  });

  it('starts the upload with what was entered, closes, and leaves the transfer to the widget', async () => {
    const { started, finishTransfer } = serveUpload();
    const { user, dialog } = await openDialog();

    await user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, CLIP);
    await user.type(within(dialog).getByRole('textbox', { name: 'Video title' }), 'Harbour');
    await user.click(within(dialog).getByRole('combobox', { name: 'Visibility' }));
    await user.click(await screen.findByRole('option', { name: 'Public' }));
    await user.click(submit(dialog));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(started).toEqual([
      {
        filename: 'clip.mp4',
        sizeBytes: 8,
        contentType: 'video/mp4',
        title: 'Harbour',
        visibility: 'public',
      },
    ]);
    expect(await screen.findByRole('complementary', { name: 'Uploads' })).toBeInTheDocument();
    finishTransfer();
  });

  it('says so, and starts no second upload, while a file is still being sent', async () => {
    const { finishTransfer } = serveUpload();
    const { user } = await renderStudio();
    await uploadClip(user, 'First');
    await screen.findByRole('progressbar', { name: 'Upload progress of First' });

    await user.click(await openButton());
    const reopened = await screen.findByRole('dialog', { name: 'Upload a video' });

    expect(within(reopened).getByRole('status')).toHaveTextContent('still uploading');
    expect(submit(reopened)).toBeDisabled();
    finishTransfer();
    await vi.waitFor(() => expect(within(reopened).queryByRole('status')).not.toBeInTheDocument());
  });
});
