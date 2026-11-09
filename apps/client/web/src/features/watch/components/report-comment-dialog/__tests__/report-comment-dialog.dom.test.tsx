import { screen, within } from '@testing-library/react';
import { listVideoComments, reportComment } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { COMMENT_ID, comment, OTHER_ID, viewerAccount } from '#app/__tests__/comment-fixtures';
import { renderDiscussion } from '#app/features/watch/__tests__/render-discussion';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const filed = () =>
  HttpResponse.json(
    {
      id: '0190c3a0-5e1d-7000-8000-00000000f001',
      commentId: COMMENT_ID,
      reason: 'harassment',
      note: 'Third time today',
      createdAt: '2026-10-14T09:12:00.000Z',
      resolvedAt: null,
      resolution: null,
    } as const,
    { status: 201 }
  );

async function openReport(reply: () => Response = filed) {
  const sent: unknown[] = [];
  const report = mockEndpoint(reportComment, async ({ request, params }) => {
    sent.push({ id: params.id, ...(await request.json()) });
    return reply();
  });
  const thread = mockEndpoint(listVideoComments, () =>
    HttpResponse.json({ items: [comment()], nextCursor: null, total: 1 })
  );
  const { user } = await renderDiscussion({
    viewer: viewerAccount(OTHER_ID),
    handlers: [thread, report],
  });
  const article = (await screen.findByText('Ines Carvalho')).closest('article');
  if (!article) {
    throw new Error('the comment did not render');
  }
  await user.click(within(article).getByRole('button', { name: 'More actions' }));
  await user.click(screen.getByRole('menuitem', { name: 'Report' }));
  const dialog = within(await screen.findByRole('dialog', { name: 'Report this comment' }));

  return { user, dialog, sent };
}

describe('apps/client/web: report comment dialog', () => {
  it('sends the reason and note, thanks the viewer and closes', async () => {
    const { user, dialog, sent } = await openReport();
    const submit = dialog.getByRole('button', { name: 'Send report' });
    expect(submit).toBeDisabled();

    await user.click(dialog.getByRole('radio', { name: 'Harassment' }));
    await user.type(dialog.getByRole('textbox', { name: 'Note (optional)' }), 'Third time today');
    await user.click(submit);

    expect(await screen.findByText('Thanks, the comment was reported')).toBeInTheDocument();
    expect(sent).toEqual([{ id: COMMENT_ID, reason: 'harassment', note: 'Third time today' }]);
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('says so when the viewer already reported the comment', async () => {
    const { user, dialog } = await openReport(() =>
      problemReply(ErrorCodes.COMMENT_ALREADY_REPORTED)
    );

    await user.click(dialog.getByRole('radio', { name: 'Spam' }));
    await user.click(dialog.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByText('You already reported this comment.')).toBeInTheDocument();
  });
});
