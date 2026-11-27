import { screen, waitFor } from '@testing-library/react';
import { rejectHeldVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { renderScreening, screeningCase } from '#app/features/admin/__tests__/screening.fixture';

const HELD = screeningCase({ title: 'Held clip' });

const openDialog = async (handlers: Parameters<typeof renderScreening>[1] = {}) => {
  const rendered = await renderScreening('/admin/screening', { cases: [[HELD]], ...handlers });
  await rendered.user.click(await screen.findByRole('button', { name: 'Reject Held clip' }));
  return { ...rendered, dialog: await screen.findByRole('dialog') };
};

describe('apps/client/studio: ScreeningRejectDialog', () => {
  it('names the video, needs a reason, and rejects with it trimmed', async () => {
    const { user, requests, dialog } = await openDialog();
    const reject = screen.getByRole('button', { name: 'Reject' });

    expect(dialog).toHaveAccessibleName('Reject Held clip?');
    expect(reject).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Reason' }), '  A copy of another upload ');
    await user.click(reject);

    await waitFor(() =>
      expect(requests.decisions).toEqual([
        { action: 'reject', id: HELD.videoId, body: { reason: 'A copy of another upload' } },
      ])
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('rejects nothing when cancelled', async () => {
    const { user, requests } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requests.decisions).toEqual([]);
  });

  it('toasts when the rejection is refused', async () => {
    const { user } = await openDialog({
      handlers: [mockEndpoint(rejectHeldVideo, () => problemReply(ErrorCodes.FORBIDDEN))],
    });

    await user.type(screen.getByRole('textbox', { name: 'Reason' }), 'A copy');
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('The decision was not saved.')).toBeInTheDocument();
  });
});
