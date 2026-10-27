import type { CommentReportQueueItem } from '@vp/domain';
import { toCommentReportQueueItemView, toCommentReportView } from '../comment-report-views';

const AT = new Date('2026-03-01T12:00:00.000Z');

const REPORT: CommentReportQueueItem = {
  id: 'r-1',
  commentId: 'c-1',
  reporterId: 'u-2',
  reason: 'spam',
  note: null,
  createdAt: AT,
  resolvedAt: null,
  resolution: null,
  comment: { id: 'c-1', videoId: 'v-1', authorId: 'u-1', content: 'buy now', removed: false },
};

describe('apps/server/api/services: comment report views', () => {
  it.each([
    { scenario: 'open', resolvedAt: null, expected: null },
    { scenario: 'resolved', resolvedAt: AT, expected: AT.toISOString() },
  ])('renders the dates of an $scenario report as ISO strings', ({ resolvedAt, expected }) => {
    const { comment: _comment, ...report } = REPORT;

    expect(toCommentReportView({ ...report, resolvedAt })).toMatchObject({
      createdAt: AT.toISOString(),
      resolvedAt: expected,
    });
  });

  it('carries the reporter and the comment on a queue item', () => {
    expect(toCommentReportQueueItemView(REPORT)).toMatchObject({
      reporterId: 'u-2',
      comment: { id: 'c-1', content: 'buy now', removed: false },
    });
  });
});
