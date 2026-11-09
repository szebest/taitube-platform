import { reportComment } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { COMMENT_ID } from '#app/__tests__/comment-fixtures';
import { AppProviders } from '#app/__tests__/providers';
import { useReportComment } from '../use-report-comment';

describe('apps/client/web: useReportComment', () => {
  it('files the report against the comment', async () => {
    const filed: unknown[] = [];
    apiServer.use(
      mockEndpoint(reportComment, async ({ request, params }) => {
        const body = await request.json();
        filed.push({ id: params.id, ...body });
        return HttpResponse.json(
          {
            id: '0190c3a0-5e1d-7000-8000-00000000f001',
            commentId: COMMENT_ID,
            reason: body.reason,
            note: null,
            createdAt: '2026-10-14T09:12:00.000Z',
            resolvedAt: null,
            resolution: null,
          },
          { status: 201 }
        );
      })
    );

    await runMutation(
      createQueryClient(),
      () => useReportComment(COMMENT_ID),
      { reason: 'spam' },
      AppProviders
    );

    expect(filed).toEqual([{ id: COMMENT_ID, reason: 'spam' }]);
  });
});
