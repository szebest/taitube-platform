import { screen, waitFor } from '@testing-library/react';
import { replayDlqEntry } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';

import { dlqEntry, renderQueues } from './queues.fixture';

const ENTRY = dlqEntry({ jobId: 'job-1', queue: 'transcode' });

const askTo = async (action: 'Replay' | 'Discard', handlers: Parameters<typeof renderQueues>[2] = {}) => {
  const rendered = await renderQueues('/admin/queues', [ENTRY], handlers);
  await rendered.user.click(await screen.findByRole('button', { name: `${action} job-1` }));
  return { ...rendered, dialog: await screen.findByRole('alertdialog') };
};

describe('apps/client/studio: DlqActionDialog', () => {
  it('names the job and its queue, focuses Cancel and replays on confirm', async () => {
    const { user, requests, dialog } = await askTo('Replay');

    expect(dialog).toHaveAccessibleName('Replay job-1?');
    expect(dialog).toHaveAccessibleDescription(/back onto the transcode queue/);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Replay' }));

    await waitFor(() => expect(requests.replayed).toEqual([ENTRY.id]));
  });

  it('names the job and that it cannot be undone before discarding it', async () => {
    const { user, requests, dialog } = await askTo('Discard');

    expect(dialog).toHaveAccessibleName('Discard job-1?');
    expect(dialog).toHaveAccessibleDescription(/cannot be undone/);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(requests.discarded).toEqual([ENTRY.id]));
  });

  it('does nothing when cancelled', async () => {
    const { user, requests } = await askTo('Discard');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(requests.discarded).toEqual([]);
  });

  it('toasts when the entry cannot be updated', async () => {
    const { user } = await askTo('Replay', {
      handlers: [mockEndpoint(replayDlqEntry, () => problemReply(ErrorCodes.DLQ_ENTRY_NOT_FOUND))],
    });

    await user.click(screen.getByRole('button', { name: 'Replay' }));

    expect(await screen.findByText('The job was not updated.')).toBeInTheDocument();
  });
});
