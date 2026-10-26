import { listCommentReports, reportComment, resolveCommentReport } from '../comment-reports';

describe('packages/api-contracts: comment reports', () => {
  it.each([
    { endpoint: reportComment, method: 'POST', path: '/v1/comments/:id/reports' },
    { endpoint: listCommentReports, method: 'GET', path: '/v1/admin/reports' },
    { endpoint: resolveCommentReport, method: 'POST', path: '/v1/admin/reports/:id/resolve' },
  ])('serves $method $path', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path });
  });

  it.each([{ reason: 'spam' }, { reason: 'other', note: 'because' }])(
    'accepts the report %o',
    (body) => {
      expect(reportComment.body.safeParse(body).success).toBe(true);
    }
  );

  it.each([{}, { reason: 'rude' }, { reason: 'spam', note: 4 }])(
    'refuses the report %o',
    (body) => {
      expect(reportComment.body.safeParse(body).success).toBe(false);
    }
  );

  it.each([{ resolution: 'removed' }, { resolution: 'dismissed' }])(
    'accepts the resolution %o',
    (body) => {
      expect(resolveCommentReport.body.safeParse(body).success).toBe(true);
    }
  );

  it('refuses a resolution that is neither removed nor dismissed', () => {
    expect(resolveCommentReport.body.safeParse({ resolution: 'banned' }).success).toBe(false);
  });

  it('promises a conflict for a second report and for a resolved one', () => {
    expect(reportComment.errors[409]).toContain('COMMENT_ALREADY_REPORTED');
    expect(resolveCommentReport.errors[409]).toContain('REPORT_ALREADY_RESOLVED');
  });
});
