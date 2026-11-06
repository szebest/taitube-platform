import { screen, within } from '@testing-library/react';

import { CLIP, renderStudio, serveUpload } from '#app/features/upload/__tests__/upload-api.fixture';

function fileInputOf(dialog: HTMLElement): HTMLInputElement {
  const input = dialog.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('the upload dialog has no file input');
  return input;
}

async function openUploadDialog() {
  const { started } = serveUpload();
  const { user } = await renderStudio();
  const banner = within(await screen.findByRole('banner'));
  await user.click(banner.getByRole('button', { name: 'Upload' }));
  const dialog = await screen.findByRole('dialog', { name: 'Upload a video' });
  return {
    user,
    dialog,
    snapshot: () => ({ dom: dialog.innerHTML, started: [...started] }),
  };
}

describe('apps/client/studio: UploadDialog, compiled and uncompiled', () => {
  it('fills in and starts an upload the same way in both builds', async () => {
    const { user, dialog, snapshot } = await openUploadDialog();
    const steps = [snapshot()];

    await user.upload(fileInputOf(dialog), CLIP);
    await user.type(within(dialog).getByRole('textbox', { name: 'Video title' }), 'Harbour');
    steps.push(snapshot());
    await user.click(within(dialog).getByRole('combobox', { name: 'Visibility' }));
    await user.click(await screen.findByRole('option', { name: 'Public' }));
    steps.push(snapshot());
    await user.click(within(dialog).getByRole('button', { name: 'Upload' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    steps.push(snapshot());

    expect(steps).toMatchSnapshot();
  });
});
