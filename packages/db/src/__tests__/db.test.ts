import { ErrorCodes } from '@vp/errors';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDbClient } from '../client.js';
import { claimStep, completeStep } from '../repository/steps.js';
import { getVideoById, transitionVideo, updateVideoMetadata } from '../repository/videos.js';
import { users, videoEvents, videos } from '../schema.js';
import { DEV_USER_ID, seedDatabase } from '../seed.js';

describe('packages/db durability and guarantees (AC 1, AC 3, AC 4)', () => {
  const { db, sql } = createDbClient();

  beforeAll(async () => {
    // Seed dev users and baseline data
    await seedDatabase();
  });

  afterAll(async () => {
    await sql.end();
  });

  it('AC 1: seed inserts dev user + one READY video', async () => {
    const user = await db.select().from(users).where(eq(users.id, DEV_USER_ID)).limit(1);
    expect(user.length).toBe(1);
    expect(user[0]?.email).toBe('dev@video-pipeline.local');

    const video = await getVideoById(db, '018f0000-0000-7000-8000-000000000001');
    expect(video).toBeDefined();
    expect(video?.status).toBe('READY');
    expect(video?.title).toBe('Test Sintel Trailer');
    expect(video?.masterPlaylistKey).toContain('master.m3u8');
  });

  it('AC 3: concurrency test on real Postgres — two parallel CAS transitions UPLOADED->PROBING -> exactly one succeeds', async () => {
    const testVideoId = uuidv7();

    // Insert initial video row in UPLOADING status, then transition to UPLOADED
    await db.insert(videos).values({
      id: testVideoId,
      ownerId: DEV_USER_ID,
      title: 'CAS Concurrency Test Video',
      status: 'UPLOADING',
      sourceKey: `raw/${testVideoId}/source.mp4`,
    });

    const toUploaded = await transitionVideo(db, {
      videoId: testVideoId,
      from: 'UPLOADING',
      to: 'UPLOADED',
    });
    expect(toUploaded).toBe(true);

    // Two parallel workers attempt CAS transition UPLOADED -> PROBING simultaneously
    const [result1, result2] = await Promise.all([
      transitionVideo(db, {
        videoId: testVideoId,
        from: 'UPLOADED',
        to: 'PROBING',
        eventPayload: { worker: 'worker-A' },
      }),
      transitionVideo(db, {
        videoId: testVideoId,
        from: 'UPLOADED',
        to: 'PROBING',
        eventPayload: { worker: 'worker-B' },
      }),
    ]);

    // Exactly one must succeed (true), exactly one must fail (false)
    const successCount = (result1 ? 1 : 0) + (result2 ? 1 : 0);
    expect(successCount).toBe(1);

    // Verify video is now in PROBING status
    const current = await getVideoById(db, testVideoId);
    expect(current?.status).toBe('PROBING');
  });

  it('AC 4: every state transition helper writes a video_events row in the same transaction (atomic guarantee)', async () => {
    const testVideoId = uuidv7();

    await db.insert(videos).values({
      id: testVideoId,
      ownerId: DEV_USER_ID,
      title: 'Event Count Test Video',
      status: 'UPLOADING',
      sourceKey: `raw/${testVideoId}/source.mp4`,
    });

    const initialEvents = await db
      .select()
      .from(videoEvents)
      .where(eq(videoEvents.videoId, testVideoId));
    expect(initialEvents.length).toBe(0);

    // Successful transition 1: UPLOADING -> UPLOADED
    const ok1 = await transitionVideo(db, {
      videoId: testVideoId,
      from: 'UPLOADING',
      to: 'UPLOADED',
      eventType: 'upload.completed',
      eventPayload: { size: 1024 },
    });
    expect(ok1).toBe(true);

    const afterFirst = await db
      .select()
      .from(videoEvents)
      .where(eq(videoEvents.videoId, testVideoId));
    expect(afterFirst.length).toBe(1);
    expect(afterFirst[0]?.type).toBe('upload.completed');

    // Failed CAS transition: attempting UPLOADING -> UPLOADED again (status is now UPLOADED)
    const failedCas = await transitionVideo(db, {
      videoId: testVideoId,
      from: 'UPLOADING',
      to: 'UPLOADED',
      eventType: 'upload.completed',
    });
    expect(failedCas).toBe(false);

    // Event count MUST NOT change when CAS fails
    const afterFailed = await db
      .select()
      .from(videoEvents)
      .where(eq(videoEvents.videoId, testVideoId));
    expect(afterFailed.length).toBe(1);
  });

  it('AC 3: fenced completion with a stale token changes 0 rows and reports fenced: true', async () => {
    const testVideoId = uuidv7();
    await db.insert(videos).values({
      id: testVideoId,
      ownerId: DEV_USER_ID,
      title: 'Fencing Test Video',
      status: 'PROCESSING',
      sourceKey: `raw/${testVideoId}/source.mp4`,
    });

    const stepId = uuidv7();
    const token1 = uuidv7();
    const token2 = uuidv7();

    // 1. Worker 1 claims probe step
    const claim1 = await claimStep(db, {
      id: stepId,
      videoId: testVideoId,
      step: 'probe',
      jobId: `${testVideoId}--probe-1`,
      attempt: 1,
      workerId: 'worker-1',
      lockToken: token1,
    });
    expect(claim1.fenced).toBe(false);
    expect(claim1.lockToken).toBe(token1);

    // 2. Worker 2 re-claims probe step (e.g. Worker 1 was slow or stalled)
    const claim2 = await claimStep(db, {
      id: stepId,
      videoId: testVideoId,
      step: 'probe',
      jobId: `${testVideoId}--probe-2`,
      attempt: 2,
      workerId: 'worker-2',
      lockToken: token2,
    });
    expect(claim2.fenced).toBe(false);
    expect(claim2.lockToken).toBe(token2);

    // 3. Worker 1 (now zombie) attempts completion with stale token1 -> FENCED OUT!
    const staleComplete = await completeStep(db, {
      videoId: testVideoId,
      step: 'probe',
      lockToken: token1,
      result: { probeData: 'from-zombie-worker' },
    });
    expect(staleComplete.completed).toBe(false);
    expect(staleComplete.fenced).toBe(true);

    // 4. Worker 2 completes with active token2 -> SUCCEEDS
    const validComplete = await completeStep(db, {
      videoId: testVideoId,
      step: 'probe',
      lockToken: token2,
      result: { duration: 60 },
    });
    expect(validComplete.completed).toBe(true);
    expect(validComplete.fenced).toBe(false);

    // 5. Subsequent claim on finished ('DONE') step is rejected
    const reClaimFinished = await claimStep(db, {
      id: uuidv7(),
      videoId: testVideoId,
      step: 'probe',
      jobId: `${testVideoId}--probe-3`,
      attempt: 3,
      workerId: 'worker-3',
      lockToken: uuidv7(),
    });
    expect(reClaimFinished.fenced).toBe(true);
    expect(reClaimFinished.lockToken).toBeNull();
  });

  it('AC 3: stale version on metadata update throws VERSION_CONFLICT (409)', async () => {
    const testVideoId = uuidv7();
    await db.insert(videos).values({
      id: testVideoId,
      ownerId: DEV_USER_ID,
      title: 'Original Title',
      status: 'READY',
      sourceKey: `raw/${testVideoId}/source.mp4`,
      version: 5,
    });

    // Stale version (e.g. 4 instead of 5)
    await expect(
      updateVideoMetadata(db, {
        videoId: testVideoId,
        version: 4,
        patch: { title: 'New Stale Title' },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: ErrorCodes.VERSION_CONFLICT,
      })
    );

    // Correct version (5) succeeds and bumps version to 6
    const updated = await updateVideoMetadata(db, {
      videoId: testVideoId,
      version: 5,
      patch: { title: 'Updated Title' },
    });
    expect(updated.title).toBe('Updated Title');
    expect(updated.version).toBe(6);
  });
});
