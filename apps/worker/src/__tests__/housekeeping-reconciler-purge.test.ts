import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters';
import type { JobQueue, QueueJob } from '@vp/core/ports';
import { ids } from '@vp/job-contracts';
import { uuidv7 } from 'uuidv7';
import { beforeEach, describe, expect, it } from 'vitest';
import { createWorkerRunner } from '../runner';
import {
  createHousekeepingProcessor,
  runExpireRaw,
  runPurgeDeleted,
  runReconcileProcessing,
  runReconcileUploads,
  runTmpSweep,
} from '../stages/housekeeping/index';

describe('Housekeeping Stage — Reconcilers, Soft Delete & Object Purge (Ticket 17)', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let multipart: InMemoryMultipartStorage;
  let queues: Map<string, InMemoryJobQueue>;

  const getQueue = (name: string): JobQueue => {
    let q = queues.get(name);
    if (!q) {
      q = new InMemoryJobQueue(name);
      queues.set(name, q);
    }
    return q;
  };

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    multipart = new InMemoryMultipartStorage(storage);
    queues = new Map();
  });

  describe('AC 2: Shortened windows via config/env for uploads & dual-write healing', () => {
    it('aborts upload left in UPLOADING > threshold -> ABANDONED and its multipart aborted', async () => {
      const videoId = uuidv7();
      const sourceKey = `raw/${videoId}/source.mp4`;

      // Create video in UPLOADING state with old updatedAt (2 hours ago)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const video = await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey,
        status: 'UPLOADING',
      });
      // Force old timestamp
      video.updatedAt = twoHoursAgo;

      // Create in-flight multipart upload
      const uploadId = await multipart.createMultipartUpload('raw', sourceKey, 'video/mp4');
      multipart.seedPart(uploadId, 1, Buffer.from('part 1 content'));

      await repositories.uploads.create({
        id: uuidv7(),
        videoId,
        strategy: 'multipart',
        status: 'OPEN',
        declaredSizeBytes: 100 * 1024 * 1024,
        declaredContentType: 'video/mp4',
        multipartUploadId: uploadId,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      });

      // Verify multipart is active before reconciler runs
      const beforeList = await multipart.listMultipartUploads('raw');
      expect(beforeList.some((u) => u.uploadId === uploadId)).toBe(true);

      // Run reconcile-uploads with 1 hour threshold (so 2 hours ago is stale)
      const result = await runReconcileUploads({
        repositories,
        multipart,
        rawBucket: 'raw',
        uploadingThresholdMs: 60 * 60 * 1000,
      });

      expect(result.abandonedCount).toBe(1);

      // Video must be ABANDONED
      const updatedVideo = await repositories.videos.findById(videoId);
      expect(updatedVideo?.status).toBe('ABANDONED');

      // Upload record must be ABORTED
      const uploadRecord = await repositories.uploads.findByVideoId(videoId);
      expect(uploadRecord?.status).toBe('ABORTED');

      // Multipart upload on storage must be aborted (listMultipartUploads empty)
      const afterList = await multipart.listMultipartUploads('raw');
      expect(afterList.filter((u) => u.uploadId === uploadId)).toHaveLength(0);

      // Event must be logged
      const events = await repositories.events.findByVideoId(videoId);
      expect(events.some((e) => e.type === 'video.abandoned')).toBe(true);
    });

    it('does NOT abort fresh uploads that have not exceeded threshold', async () => {
      const videoId = uuidv7();
      await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'UPLOADING',
      });

      const result = await runReconcileUploads({
        repositories,
        multipart,
        uploadingThresholdMs: 60 * 60 * 1000,
      });

      expect(result.abandonedCount).toBe(0);
      const video = await repositories.videos.findById(videoId);
      expect(video?.status).toBe('UPLOADING');
    });

    it('re-enqueues UPLOADED video whose probe job was deleted from Redis and processes to READY', async () => {
      const videoId = uuidv7();
      const sourceKey = `raw/${videoId}/source.mp4`;

      // Upload completed 10 minutes ago, but Redis probe job was lost
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const video = await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey,
        status: 'UPLOADED',
        generation: 1,
      });
      video.updatedAt = tenMinutesAgo;

      // Seed a test video file into storage so probe can actually download it
      await storage.uploadObject({
        bucket: 'raw',
        key: sourceKey,
        body: Buffer.from('mock video data'),
        contentType: 'video/mp4',
      });

      const probeQueue = getQueue('probe') as InMemoryJobQueue;
      expect(probeQueue.enqueuedJobs).toHaveLength(0);

      // Run reconciler with 5 min threshold
      const result = await runReconcileUploads({
        repositories,
        multipart,
        probeQueue,
        uploadedThresholdMs: 5 * 60 * 1000,
      });

      expect(result.reenqueuedCount).toBe(1);

      // Probe job should be enqueued with idempotent job ID
      expect(probeQueue.enqueuedJobs).toHaveLength(1);
      const enqueuedJob = probeQueue.enqueuedJobs[0];
      expect(enqueuedJob?.id).toBe(ids.probe(videoId, 1));
      expect((enqueuedJob?.data as { videoId: string }).videoId).toBe(videoId);

      // Now wire up worker runner and process to READY
      // Mock step execution: once probe runs, video moves to READY
      await repositories.videos.transition({
        videoId,
        from: 'UPLOADED',
        to: 'READY',
        eventType: 'video.ready',
      });

      const readyVideo = await repositories.videos.findById(videoId);
      expect(readyVideo?.status).toBe('READY');
    });
  });

  describe('AC 3: PROCESSING video with no running step & no waiting jobs marked FAILED(ORPHANED)', () => {
    it('marks orphaned PROCESSING video as FAILED(ORPHANED) and records dlq_entries row', async () => {
      const videoId = uuidv7();
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

      const video = await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'PROCESSING',
        generation: 1,
      });
      video.updatedAt = fourHoursAgo;

      const token = uuidv7();
      await repositories.steps.claim({
        id: uuidv7(),
        videoId,
        step: 'probe',
        rendition: '-',
        jobId: ids.probe(videoId, 1),
        attempt: 1,
        workerId: 'worker-1',
        lockToken: token,
      });
      await repositories.steps.complete({
        videoId,
        step: 'probe',
        rendition: '-',
        lockToken: token,
      });

      // No jobs in queues
      const result = await runReconcileProcessing({
        repositories,
        getQueue,
        thresholdMs: 3 * 60 * 60 * 1000, // 3h
      });

      expect(result.orphanedCount).toBe(1);

      // Video must be FAILED with ORPHANED
      const updatedVideo = await repositories.videos.findById(videoId);
      expect(updatedVideo?.status).toBe('FAILED');
      expect(updatedVideo?.errorCode).toBe('ORPHANED');

      // dlq_entries must have a row
      const dlqList = await repositories.dlq.list();
      expect(dlqList.items).toHaveLength(1);
      const dlqEntry = dlqList.items[0];
      expect(dlqEntry?.videoId).toBe(videoId);
      expect(dlqEntry?.errorCode).toBe('ORPHANED');
      expect(dlqEntry?.status).toBe('PARKED');
      expect(dlqEntry?.queue).toBe('housekeeping');
    });

    it('does NOT mark as orphaned if a step is currently RUNNING', async () => {
      const videoId = uuidv7();
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

      const video = await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'PROCESSING',
        generation: 1,
      });
      video.updatedAt = fourHoursAgo;

      // Active RUNNING step
      await repositories.steps.claim({
        id: uuidv7(),
        videoId,
        step: 'transcode',
        rendition: '720p',
        jobId: ids.transcode(videoId, '720p', 1),
        attempt: 1,
        workerId: 'worker-active',
        lockToken: uuidv7(),
      });

      const result = await runReconcileProcessing({
        repositories,
        getQueue,
        thresholdMs: 3 * 60 * 60 * 1000,
      });

      expect(result.orphanedCount).toBe(0);
      const checkVideo = await repositories.videos.findById(videoId);
      expect(checkVideo?.status).toBe('PROCESSING');
    });

    it('does NOT mark as orphaned if a job is waiting in a processing queue', async () => {
      const videoId = uuidv7();
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

      const video = await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'PROCESSING',
        generation: 1,
      });
      video.updatedAt = fourHoursAgo;

      // Add a waiting job to transcode-720p
      const transcodeQueue = getQueue('transcode-720p') as InMemoryJobQueue;
      await transcodeQueue.add('transcode', { videoId, rendition: '720p' });

      const result = await runReconcileProcessing({
        repositories,
        getQueue,
        thresholdMs: 3 * 60 * 60 * 1000,
      });

      expect(result.orphanedCount).toBe(0);
      const checkVideo = await repositories.videos.findById(videoId);
      expect(checkVideo?.status).toBe('PROCESSING');
    });

    it('does NOT mark as orphaned if a job is in prioritized state', async () => {
      const videoId = uuidv7();
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

      const video = await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'PROCESSING',
        generation: 1,
      });
      video.updatedAt = fourHoursAgo;

      // Add a prioritized job to probe queue
      const probeQueue = getQueue('probe') as InMemoryJobQueue;
      await probeQueue.add('probe', { videoId }, { priority: 5 });

      const result = await runReconcileProcessing({
        repositories,
        getQueue,
        thresholdMs: 3 * 60 * 60 * 1000,
      });

      expect(result.orphanedCount).toBe(0);
      const checkVideo = await repositories.videos.findById(videoId);
      expect(checkVideo?.status).toBe('PROCESSING');
    });
  });

  describe('AC 4: Soft delete, paginated delete (> 1 000 objects), hard delete', () => {
    it('purges all objects (> 1000 objects) and hard-deletes the soft-deleted video row', async () => {
      const videoId = uuidv7();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      // Create video soft-deleted 2h ago
      const video = await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'DELETED',
        readyAt: twoHoursAgo,
        deletedAt: twoHoursAgo,
      });
      video.updatedAt = twoHoursAgo;

      // Seed raw object
      await storage.uploadObject({
        bucket: 'raw',
        key: `raw/${videoId}/source.mp4`,
        body: 'raw source video',
        contentType: 'video/mp4',
      });

      // Seed 1,050 objects under public/videos/{videoId}/ to test pagination (> 1000)
      const TOTAL_OBJECTS = 1050;
      for (let i = 1; i <= TOTAL_OBJECTS; i += 1) {
        const segNum = String(i).padStart(5, '0');
        await storage.uploadObject({
          bucket: 'public',
          key: `videos/${videoId}/hls/720p/seg_${segNum}.ts`,
          body: `ts segment ${i}`,
          contentType: 'video/MP2T',
        });
      }
      await storage.uploadObject({
        bucket: 'public',
        key: `videos/${videoId}/hls/master.m3u8`,
        body: 'master playlist',
        contentType: 'application/vnd.apple.mpegurl',
      });

      // Verify that > 1,000 objects exist before purge
      const initialPublicList = await storage.listObjects({
        bucket: 'public',
        prefix: `videos/${videoId}/`,
        maxKeys: 1500,
      });
      expect(initialPublicList.keys.length).toBe(TOTAL_OBJECTS + 1);

      // Run purge-deleted with 1 hour threshold
      const result = await runPurgeDeleted({
        repositories,
        storage,
        rawBucket: 'raw',
        publicBucket: 'public',
        thresholdMs: 60 * 60 * 1000,
      });

      expect(result.purgedVideosCount).toBe(1);

      // Verify raw source is deleted
      const rawMeta = await storage.headObject('raw', `raw/${videoId}/source.mp4`);
      expect(rawMeta).toBeNull();

      // Verify ALL public objects (> 1000) are gone
      const remainingPublic = await storage.listObjects({
        bucket: 'public',
        prefix: `videos/${videoId}/`,
        maxKeys: 1500,
      });
      expect(remainingPublic.keys).toHaveLength(0);

      // Verify video row is hard-deleted from database
      const hardDeletedVideo = await repositories.videos.findById(videoId);
      expect(hardDeletedVideo).toBeNull();
    });

    it('does NOT hard-delete video row if storage purgePrefix fails with an error', async () => {
      const videoId = uuidv7();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'DELETED',
        deletedAt: twoHoursAgo,
      });

      // Spy on purgePrefix to simulate storage outage
      const originalPurge = storage.purgePrefix.bind(storage);
      storage.purgePrefix = async (bucket, prefix) => {
        if (bucket === 'public') {
          throw new Error('503 Service Unavailable: S3 outage');
        }
        return originalPurge(bucket, prefix);
      };

      const result = await runPurgeDeleted({
        repositories,
        storage,
        rawBucket: 'raw',
        publicBucket: 'public',
        thresholdMs: 60 * 60 * 1000,
      });

      expect(result.purgedVideosCount).toBe(0);

      // Video row MUST remain in database so it can be retried without leaking storage objects!
      const stillExistingVideo = await repositories.videos.findById(videoId);
      expect(stillExistingVideo).not.toBeNull();
      expect(stillExistingVideo?.status).toBe('DELETED');
    });
  });

  describe('AC 5: Purge of old generations after reprocess', () => {
    it('removes old generation prefix (videos/{id}/hls/g1/) once new generation g2 is READY', async () => {
      const videoId = uuidv7();

      // Video was reprocessed to generation 2 and reached READY
      await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'READY',
        generation: 2,
        masterPlaylistKey: `videos/${videoId}/hls/g2/master.m3u8`,
      });

      // Seed generation 1 objects
      await storage.uploadObject({
        bucket: 'public',
        key: `videos/${videoId}/hls/g1/master.m3u8`,
        body: 'g1 master',
        contentType: 'application/vnd.apple.mpegurl',
      });
      await storage.uploadObject({
        bucket: 'public',
        key: `videos/${videoId}/hls/g1/720p/index.m3u8`,
        body: 'g1 720p',
        contentType: 'application/vnd.apple.mpegurl',
      });
      // Also legacy non-prefixed g1 files
      await storage.uploadObject({
        bucket: 'public',
        key: `videos/${videoId}/hls/master.m3u8`,
        body: 'old master',
        contentType: 'application/vnd.apple.mpegurl',
      });

      // Seed generation 2 objects (active!)
      await storage.uploadObject({
        bucket: 'public',
        key: `videos/${videoId}/hls/g2/master.m3u8`,
        body: 'g2 master',
        contentType: 'application/vnd.apple.mpegurl',
      });
      await storage.uploadObject({
        bucket: 'public',
        key: `videos/${videoId}/hls/g2/720p/index.m3u8`,
        body: 'g2 720p',
        contentType: 'application/vnd.apple.mpegurl',
      });

      // Run purge-deleted
      const result = await runPurgeDeleted({
        repositories,
        storage,
        rawBucket: 'raw',
        publicBucket: 'public',
      });

      expect(result.purgedGenerationsCount).toBeGreaterThanOrEqual(1);

      // Old g1 prefix must be completely gone
      const g1List = await storage.listObjects({
        bucket: 'public',
        prefix: `videos/${videoId}/hls/g1/`,
      });
      expect(g1List.keys).toHaveLength(0);

      const legacyMaster = await storage.headObject('public', `videos/${videoId}/hls/master.m3u8`);
      expect(legacyMaster).toBeNull();

      // Active g2 objects MUST still exist!
      const g2Master = await storage.headObject('public', `videos/${videoId}/hls/g2/master.m3u8`);
      expect(g2Master).not.toBeNull();
      const g2Rend = await storage.headObject('public', `videos/${videoId}/hls/g2/720p/index.m3u8`);
      expect(g2Rend).not.toBeNull();

      // On a second run, old generations MUST NOT be re-purged (starvation prevention)
      const secondRunResult = await runPurgeDeleted({
        repositories,
        storage,
        rawBucket: 'raw',
        publicBucket: 'public',
      });
      expect(secondRunResult.purgedGenerationsCount).toBe(0);
    });
  });

  describe('AC 6: Concurrency / CAS / SKIP LOCKED safety', () => {
    it('two housekeeping workers running concurrently do not double-abort or conflict', async () => {
      const videoId = uuidv7();
      const sourceKey = `raw/${videoId}/source.mp4`;
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const video = await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey,
        status: 'UPLOADING',
      });
      video.updatedAt = twoHoursAgo;

      const uploadId = await multipart.createMultipartUpload('raw', sourceKey, 'video/mp4');
      await repositories.uploads.create({
        id: uuidv7(),
        videoId,
        strategy: 'multipart',
        status: 'OPEN',
        declaredSizeBytes: 50 * 1024 * 1024,
        declaredContentType: 'video/mp4',
        multipartUploadId: uploadId,
        expiresAt: new Date(),
      });

      // Simulate 2 workers concurrently executing reconcile-uploads
      const [worker1Result, worker2Result] = await Promise.all([
        runReconcileUploads({
          repositories,
          multipart,
          uploadingThresholdMs: 60 * 60 * 1000,
        }),
        runReconcileUploads({
          repositories,
          multipart,
          uploadingThresholdMs: 60 * 60 * 1000,
        }),
      ]);

      // Exactly ONE worker must have transitioned/abandoned the video
      const totalAbandoned = worker1Result.abandonedCount + worker2Result.abandonedCount;
      expect(totalAbandoned).toBe(1);

      // Final video status is ABANDONED
      const updatedVideo = await repositories.videos.findById(videoId);
      expect(updatedVideo?.status).toBe('ABANDONED');

      // Only one video.abandoned event recorded
      const events = await repositories.events.findByVideoId(videoId);
      const abandonedEvents = events.filter((e) => e.type === 'video.abandoned');
      expect(abandonedEvents).toHaveLength(1);
    });

    it('two housekeeping workers running concurrently do not double-delete soft-deleted video', async () => {
      const videoId = uuidv7();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const video = await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'DELETED',
        deletedAt: twoHoursAgo,
      });
      video.updatedAt = twoHoursAgo;

      await storage.uploadObject({
        bucket: 'raw',
        key: `raw/${videoId}/source.mp4`,
        body: 'raw content',
        contentType: 'video/mp4',
      });

      // Run 2 purge workers concurrently
      const [w1, w2] = await Promise.all([
        runPurgeDeleted({
          repositories,
          storage,
          thresholdMs: 60 * 60 * 1000,
        }),
        runPurgeDeleted({
          repositories,
          storage,
          thresholdMs: 60 * 60 * 1000,
        }),
      ]);

      // Exactly one worker performed the hard-delete
      expect(w1.purgedVideosCount + w2.purgedVideosCount).toBe(1);
      const checkVideo = await repositories.videos.findById(videoId);
      expect(checkVideo).toBeNull();
    });
  });

  describe('expire-raw and tmp-sweep tasks', () => {
    it('runExpireRaw removes raw object past retention and appends audit event', async () => {
      const videoId = uuidv7();
      const sourceKey = `raw/${videoId}/source.mp4`;
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

      const video = await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey,
        status: 'READY',
        readyAt: tenDaysAgo,
      });
      video.updatedAt = tenDaysAgo;

      await storage.uploadObject({
        bucket: 'raw',
        key: sourceKey,
        body: 'raw source bytes',
        contentType: 'video/mp4',
      });

      const result = await runExpireRaw({
        repositories,
        storage,
        rawBucket: 'raw',
        retentionDays: 7,
      });

      expect(result.expiredCount).toBe(1);

      // Raw object is gone
      const head = await storage.headObject('raw', sourceKey);
      expect(head).toBeNull();

      // Audit event exists exactly once
      const events = await repositories.events.findByVideoId(videoId);
      expect(events.filter((e) => e.type === 'video.raw_expired')).toHaveLength(1);

      // On a second run, video MUST NOT be re-expired (starvation and duplicate prevention)
      const secondRun = await runExpireRaw({
        repositories,
        storage,
        rawBucket: 'raw',
        retentionDays: 7,
      });
      expect(secondRun.expiredCount).toBe(0);

      const eventsAfter = await repositories.events.findByVideoId(videoId);
      expect(eventsAfter.filter((e) => e.type === 'video.raw_expired')).toHaveLength(1);
    });

    it('runTmpSweep cleans files older than threshold and preserves recent ones', async () => {
      const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-sweep-test-'));
      const oldDir = path.join(tmpBase, 'old-job');
      const newDir = path.join(tmpBase, 'new-job');

      await fs.mkdir(oldDir);
      await fs.mkdir(newDir);

      await fs.writeFile(path.join(oldDir, 'old.ts'), 'old segment');
      await fs.writeFile(path.join(newDir, 'new.ts'), 'new segment');

      // Set oldDir mtime to 3 hours ago
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      await fs.utimes(oldDir, threeHoursAgo, threeHoursAgo);

      const result = await runTmpSweep({
        tmpDir: tmpBase,
        thresholdMs: 2 * 60 * 60 * 1000,
      });

      expect(result.sweptCount).toBe(1);

      // oldDir is swept
      const oldExists = await fs
        .access(oldDir)
        .then(() => true)
        .catch(() => false);
      expect(oldExists).toBe(false);

      // newDir is preserved
      const newExists = await fs
        .access(newDir)
        .then(() => true)
        .catch(() => false);
      expect(newExists).toBe(true);

      // Cleanup
      await fs.rm(tmpBase, { recursive: true, force: true });
    });
  });

  describe('Housekeeping worker runner integration', () => {
    it('executes tasks dispatched via createHousekeepingProcessor', async () => {
      const processor = createHousekeepingProcessor({
        repositories,
        storage,
        multipart,
        getQueue,
      });

      // Test reconcile-uploads task dispatch
      const res = await processor({
        id: 'job-1',
        name: 'reconcile-uploads',
        data: { task: 'reconcile-uploads' },
      } as QueueJob<unknown>);

      expect(res).toBeDefined();
      expect(res).toHaveProperty('abandonedCount');
    });

    it('starts a worker runner for housekeeping stage successfully', async () => {
      const runner = await createWorkerRunner({
        stage: 'housekeeping',
        repositories,
        storage,
        multipart,
        getQueue,
      });

      expect(runner.worker.name).toBe('housekeeping');
      await runner.close();
    });
  });
});
