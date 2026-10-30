import { screen, waitFor, within } from '@testing-library/react';
import { listCommentReports, resolveCommentReport } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw';

import { commentReport, renderModeration } from './moderation.fixture';

const comment = (content: string, removed = false) => ({ ...commentReport().comment, content, removed });
const OPEN = commentReport({ reason: 'spam', comment: comment('Buy followers') });
const REMOVED_COMMENT = commentReport({ comment: comment('Already gone', true) });
const CLOSED = commentReport({
  comment: comment('Old news'),
  resolvedAt: '2026-10-02T00:00:00.000Z',
  resolution: 'dismissed',
});

const rowOf = (text: string) => screen.getByText(text).closest('tr') as HTMLElement;

describe('apps/client/studio: ReportQueue', () => {
  it('lists the reports with the reason and state of each', async () => {
    await renderModeration('/admin/moderation', { reports: [[OPEN, CLOSED]] });

    expect(await screen.findByText('Buy followers')).toBeInTheDocument();
    expect(within(rowOf('Buy followers')).getByText('Spam')).toBeInTheDocument();
    expect(within(rowOf('Buy followers')).getByText('Open')).toBeInTheDocument();
    expect(within(rowOf('Old news')).getByText('Dismissed')).toBeInTheDocument();
  });

  it('dismisses an open report without asking', async () => {
    const { user, requests } = await renderModeration('/admin/moderation', { reports: [[OPEN]] });

    await user.click(await screen.findByRole('button', { name: 'Dismiss the report on Buy followers' }));

    await waitFor(() =>
      expect(requests.resolved).toEqual([{ id: OPEN.id, body: { resolution: 'dismissed' } }])
    );
  });

  it('offers actions only on an open report, and no removal of a comment already removed', async () => {
    await renderModeration('/admin/moderation', { reports: [[OPEN, REMOVED_COMMENT, CLOSED]] });
    await screen.findByText('Buy followers');

    expect(screen.getAllByRole('button', { name: /^Dismiss the report on/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(1);
    expect(within(rowOf('Old news')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('loads the next page of reports on request', async () => {
    const { user, requests } = await renderModeration('/admin/moderation', {
      reports: [[OPEN], [CLOSED]],
    });
    await screen.findByText('Buy followers');

    await user.click(screen.getAllByRole('button', { name: 'Load more' }).at(-1) as HTMLElement);

    expect(await screen.findByText('Old news')).toBeInTheDocument();
    expect(requests.reportCursors).toEqual([null, '1']);
  });

  it('shows one empty state with no action when nothing is reported', async () => {
    await renderModeration('/admin/moderation', { reports: [[]] });

    const empty = (await screen.findByText('No reported comments')).closest('[data-slot]') as HTMLElement;

    expect(screen.getByText('Comments viewers report appear here.')).toBeInTheDocument();
    expect(within(empty.parentElement as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it('toasts when a report cannot be resolved', async () => {
    const { user } = await renderModeration('/admin/moderation', {
      reports: [[OPEN]],
      handlers: [
        mockEndpoint(resolveCommentReport, () => problemReply(ErrorCodes.REPORT_ALREADY_RESOLVED)),
      ],
    });

    await user.click(await screen.findByRole('button', { name: 'Dismiss the report on Buy followers' }));

    expect(await screen.findByText('The report was not resolved.')).toBeInTheDocument();
  });

  it('keeps the page and offers a retry when the reports fail to load', async () => {
    let failing = true;
    const { user } = await renderModeration('/admin/moderation', {
      handlers: [
        mockEndpoint(listCommentReports, () =>
          failing
            ? problemReply(ErrorCodes.INTERNAL)
            : HttpResponse.json({ items: [OPEN], nextCursor: null })
        ),
      ],
    });

    expect(await screen.findByText('The reports did not load.')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Every video' })).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Buy followers')).toBeInTheDocument();
  });
});
