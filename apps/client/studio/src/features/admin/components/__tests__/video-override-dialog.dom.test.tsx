import { screen, waitFor } from '@testing-library/react';
import { updateCreatorVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';

import { adminVideo, renderModeration } from './moderation.fixture';

const VIDEO = adminVideo({ title: 'Cats', version: 7 });

const askTo = async (action: string, handlers: Parameters<typeof renderModeration>[1] = {}) => {
  const rendered = await renderModeration('/admin/moderation', { videos: [[VIDEO]], ...handlers });
  await rendered.user.click(await screen.findByRole('button', { name: 'Actions for Cats' }));
  await rendered.user.click(await screen.findByRole('menuitem', { name: action }));
  return { ...rendered, dialog: await screen.findByRole('alertdialog') };
};

describe('apps/client/studio: VideoOverrideDialog', () => {
  it('names the video, focuses Cancel and forces it private against its version on confirm', async () => {
    const { user, requests, dialog } = await askTo('Force private');

    expect(dialog).toHaveAccessibleName('Make Cats private?');
    expect(dialog).toHaveAccessibleDescription(/Cats stops being watchable/);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Force private' }));

    await waitFor(() =>
      expect(requests.patched).toEqual([
        { id: VIDEO.id, body: { visibility: 'private', version: 7 } },
      ])
    );
  });

  it('asks for a reason before rejecting and sends it trimmed', async () => {
    const { user, requests, dialog } = await askTo('Reject');
    const confirm = screen.getByRole('button', { name: 'Reject' });

    expect(dialog).toHaveAccessibleName('Reject Cats?');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(confirm).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Reason' }), '  Misleading title ');
    await user.click(confirm);

    await waitFor(() =>
      expect(requests.takenDown).toEqual([{ id: VIDEO.id, body: { reason: 'Misleading title' } }])
    );
  });

  it('names the video and its fate before deleting it', async () => {
    const { user, requests, dialog } = await askTo('Delete');

    expect(dialog).toHaveAccessibleName('Delete Cats?');
    expect(dialog).toHaveAccessibleDescription(/deleted for good/);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(requests.deleted).toEqual([VIDEO.id]));
  });

  it('sends nothing when cancelled', async () => {
    const { user, requests } = await askTo('Delete');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(requests.deleted).toEqual([]);
  });

  it.each([
    { scenario: 'a stale version', code: ErrorCodes.VERSION_CONFLICT, message: /changed since this list loaded/ },
    { scenario: 'any other refusal', code: ErrorCodes.FORBIDDEN, message: /change was not saved/ },
  ])('says so on a toast after $scenario', async ({ code, message }) => {
    const { user } = await askTo('Force private', {
      handlers: [mockEndpoint(updateCreatorVideo, () => problemReply(code))],
    });

    await user.click(screen.getByRole('button', { name: 'Force private' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
