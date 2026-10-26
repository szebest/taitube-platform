import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { Singleflight } from '@vp/concurrency';
import type { CommentCachePort } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { CommentReportService } from '../comment-report-service';
import { CommentService } from '../comment-service';

const OWNER: UserContext = { id: '11111111-1111-7111-8111-111111111111', role: 'CREATOR' };
const AUTHOR: UserContext = { id: '22222222-2222-7222-8222-222222222222', role: 'USER' };
const REPORTER: UserContext = { id: '33333333-3333-7333-8333-333333333333', role: 'USER' };
const ADMIN: UserContext = { id: '44444444-4444-7444-8444-444444444444', role: 'ADMIN' };
const VIDEO_ID = '55555555-5555-7555-8555-555555555555';
const PRIVATE_ID = '66666666-6666-7666-8666-666666666666';

describe('CommentReportService', () => {
  let repositories: InMemoryRepositories;
  let invalidated: string[];
  let service: CommentReportService;
  let commentId: string;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    invalidated = [];
    const commentCache: CommentCachePort = {
      getHot: async (_videoId, fetcher) => fetcher(),
      invalidate: async (videoId) => {
        invalidated.push(videoId);
        return ok();
      },
    };
    const paginator = new Paginator();
    const commentService = new CommentService({
      comments: repositories.comments,
      videos: repositories.videos,
      commentCache,
      singleflight: new Singleflight(),
      paginator,
    });
    service = new CommentReportService({
      comments: repositories.comments,
      videos: repositories.videos,
      reports: repositories.commentReports,
      commentService,
      paginator,
    });
    for (const [id, visibility] of [
      [VIDEO_ID, 'public'],
      [PRIVATE_ID, 'private'],
    ] as const) {
      await repositories.videos.create({
        id,
        ownerId: OWNER.id,
        sourceKey: `raw/${id}/source.mp4`,
        visibility,
        status: 'READY',
      });
    }
    commentId = expectOk(await commentService.create(AUTHOR, VIDEO_ID, { content: 'spam' })).id;
  });

  const report = (reporter = REPORTER, id = commentId) =>
    service.report(reporter, id, { reason: 'spam', note: ' link farm ' });

  it('stores the report with its trimmed note and refuses the same reporter a second time', async () => {
    const created = expectOk(await report());
    const again = await report();

    expect(created).toMatchObject({
      commentId,
      reason: 'spam',
      note: 'link farm',
      resolution: null,
    });
    expect(expectErr(again).code).toBe(ErrorCodes.COMMENT_ALREADY_REPORTED);
  });

  it('hides a comment under a video the reporter cannot read', async () => {
    const hidden = expectOk(
      await repositories.comments.create({
        id: '77777777-7777-7777-8777-777777777777',
        videoId: PRIVATE_ID,
        authorId: OWNER.id,
        parentId: null,
        content: 'draft',
      })
    );

    expect(expectErr(await report(REPORTER, hidden?.id)).code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('lists the queue for an admin only', async () => {
    await report();

    expect(expectOk(await service.list(ADMIN, {})).items).toHaveLength(1);
    expect(expectErr(await service.list(REPORTER, {})).code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('removes the comment through the comment service when resolved as removed', async () => {
    const created = expectOk(await report());
    invalidated.length = 0;

    const resolved = expectOk(await service.resolve(ADMIN, created.id, 'removed'));

    expect(resolved.resolution).toBe('removed');
    expect(expectOk(await repositories.comments.findById(commentId))).toBeNull();
    expect(invalidated).toEqual([VIDEO_ID]);
  });

  it('keeps the comment when resolved as dismissed, and resolves a report once', async () => {
    const created = expectOk(await report());

    expectOk(await service.resolve(ADMIN, created.id, 'dismissed'));
    const again = await service.resolve(ADMIN, created.id, 'dismissed');

    expect(expectOk(await repositories.comments.findById(commentId))).not.toBeNull();
    expect(expectErr(again).code).toBe(ErrorCodes.REPORT_ALREADY_RESOLVED);
  });

  it('refuses anyone but an admin and an unknown report', async () => {
    const created = expectOk(await report());

    expect(expectErr(await service.resolve(OWNER, created.id, 'removed')).code).toBe(
      ErrorCodes.FORBIDDEN
    );
    expect(
      expectErr(await service.resolve(ADMIN, '88888888-8888-7888-8888-888888888888', 'removed'))
        .code
    ).toBe(ErrorCodes.REPORT_NOT_FOUND);
  });
});
