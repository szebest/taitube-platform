import { screen, waitFor } from '@testing-library/react';
import { resolveCommentReport } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';

import { commentReport, renderModeration } from './moderation.fixture';

const REPORT = commentReport({
  comment: { ...commentReport().comment, content: 'Buy followers' },
});

const askToRemove = async (handlers: Parameters<typeof renderModeration>[1] = {}) => {
  const rendered = await renderModeration('/admin/moderation', { reports: [[REPORT]], ...handlers });
  await rendered.user.click(await screen.findByRole('button', { name: 'Remove Buy followers' }));
  return { ...rendered, dialog: await screen.findByRole('alertdialog') };
};

describe('apps/client/studio: ReportRemoveDialog', () => {
  it('names the comment and its consequence, focuses Cancel, and removes it on confirm', async () => {
    const { user, requests, dialog } = await askToRemove();

    expect(dialog).toHaveAccessibleName('Remove this comment?');
    expect(dialog).toHaveAccessibleDescription(/Buy followers is deleted with its replies/);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(requests.resolved).toEqual([{ id: REPORT.id, body: { resolution: 'removed' } }])
    );
  });

  it('resolves nothing when cancelled', async () => {
    const { user, requests } = await askToRemove();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(requests.resolved).toEqual([]);
  });

  it('toasts when the removal is refused', async () => {
    const { user } = await askToRemove({
      handlers: [
        mockEndpoint(resolveCommentReport, () => problemReply(ErrorCodes.REPORT_ALREADY_RESOLVED)),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('The report was not resolved.')).toBeInTheDocument();
  });
});
