import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { ids } from '@vp/job-contracts';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { TOKENS, type TestApp, bearer, buildTestApp } from './test-app';

const VIDEO_ID = '018f0000-0000-7000-8000-000000000030';
const OTHER_VIDEO_ID = '018f0000-0000-7000-8000-000000000031';
const RATE_LIMIT_VIDEO_ID = '018f0000-0000-7000-8000-000000000040';

describe('POST /videos/:id/reprocess', () => {
  let ctx: TestApp;
  const probeQueue = new InMemoryJobQueue('probe');

  function reprocess(videoId: string, token?: string) {
    return ctx.app.inject({
      method: 'POST',
      url: `/videos/${videoId}/reprocess`,
      headers: token ? bearer(token) : {},
    });
  }

  beforeAll(async () => {
    ctx = await buildTestApp({ adapters: { probeQueue } });
    await ctx.repositories.videos.create({
      id: VIDEO_ID,
      ownerId: SEEDED.userId,
      title: 'Reprocess Test Video',
      status: 'FAILED',
      sourceKey: `raw/${VIDEO_ID}/source.mp4`,
      generation: 1,
    });
    await ctx.repositories.videos.create({
      id: OTHER_VIDEO_ID,
      ownerId: SEEDED.otherUserId,
      title: 'Other User Video',
      status: 'READY',
      sourceKey: `raw/${OTHER_VIDEO_ID}/source.mp4`,
      generation: 1,
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await reprocess(VIDEO_ID);
    expect(res.statusCode).toBe(401);
  });

  it('rejects non-owner non-admin with 403', async () => {
    const res = await reprocess(VIDEO_ID, TOKENS.otherUser);
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('returns 404 for nonexistent video', async () => {
    const res = await reprocess('018f0000-0000-7000-8000-000000000999', TOKENS.admin);
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('owner can reprocess: bumps generation, transitions to PROBING, enqueues probe job', async () => {
    probeQueue.enqueuedJobs.length = 0;

    const res = await reprocess(VIDEO_ID, TOKENS.user);

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ videoId: VIDEO_ID, status: 'PROBING', generation: 2 });

    const video = expectOk(await ctx.repositories.videos.findById(VIDEO_ID));
    expect(video?.generation).toBe(2);
    expect(video?.status).toBe('PROBING');

    expect(probeQueue.enqueuedJobs).toHaveLength(1);
    const job = probeQueue.enqueuedJobs[0];
    expect(job?.id).toBe(ids.probe(VIDEO_ID, 2));
    expect(job?.data).toMatchObject({ generation: 2, videoId: VIDEO_ID });

    const events = expectOk(await ctx.repositories.events.findByVideoId(VIDEO_ID));
    const reprocessEvent = events.find((e) => e.type === 'video.reprocessing');
    expect(reprocessEvent?.payload).toMatchObject({ generation: 2 });
  });

  it('admin can reprocess any video', async () => {
    probeQueue.enqueuedJobs.length = 0;

    const res = await reprocess(OTHER_VIDEO_ID, TOKENS.admin);

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({
      videoId: OTHER_VIDEO_ID,
      generation: 2,
      status: 'PROBING',
    });
  });

  it('limits an owner to 5 reprocess requests per minute and exempts admins', async () => {
    await ctx.repositories.videos.create({
      id: RATE_LIMIT_VIDEO_ID,
      ownerId: SEEDED.userId,
      title: 'Rate Limit Test Video',
      status: 'READY',
      sourceKey: `raw/${RATE_LIMIT_VIDEO_ID}/source.mp4`,
      generation: 1,
    });
    const resetToReady = () =>
      ctx.repositories.videos.transition({
        videoId: RATE_LIMIT_VIDEO_ID,
        from: ['PROBING', 'READY'],
        to: 'READY',
        eventType: 'test.reset',
      });

    // The owner's reprocess in the test above already counts toward this window.
    for (let i = 0; i < 4; i++) {
      await resetToReady();
      const res = await reprocess(RATE_LIMIT_VIDEO_ID, TOKENS.user);
      expect(res.statusCode).toBe(202);
    }

    await resetToReady();
    const limitedRes = await reprocess(RATE_LIMIT_VIDEO_ID, TOKENS.user);
    expect(limitedRes.statusCode).toBe(429);
    expect(limitedRes.json().code).toBe(ErrorCodes.RATE_LIMITED);

    const adminRes = await reprocess(RATE_LIMIT_VIDEO_ID, TOKENS.admin);
    expect(adminRes.statusCode).toBe(202);
  });
});
