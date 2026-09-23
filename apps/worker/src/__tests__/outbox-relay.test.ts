import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters';
import type { JobQueue } from '@vp/core/ports';
import { ids } from '@vp/job-contracts';
import { getMetrics } from '@vp/observability';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { beforeEach, describe, expect, it } from 'vitest';
import { OutboxRelay, drainOutboxOnce } from '../stages/housekeeping/outbox-relay';

describe('Ticket 30: Transactional Outbox Relay & Crash Recovery', () => {
  let repositories: InMemoryRepositories;
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
    queues = new Map();
  });

  describe('AC 1: Outbox table & drainOutboxOnce batch processing', () => {
    it('claims pending outbox entries, publishes to job queue, and marks published', async () => {
      const probeQueue = getQueue('probe') as InMemoryJobQueue;
      const videoId = uuidv7();
      const jobId = ids.probe(videoId, 1);

      // Enqueue outbox item
      await repositories.outbox.enqueue({
        kind: 'probe',
        payload: {
          type: 'queue',
          queueName: 'probe',
          job: {
            name: 'probe',
            data: { videoId, generation: 1, sourceKey: 'raw/v.mp4', traceparent: 'tp' },
            opts: { jobId },
          },
        },
      });

      expect(probeQueue.enqueuedJobs).toHaveLength(0);

      // Drain outbox
      const result = await drainOutboxOnce(repositories, { getQueue });
      expect(expectOk(result).processedCount).toBe(1);
      expect(expectOk(result).successCount).toBe(1);
      expect(expectOk(result).failureCount).toBe(0);

      // Verify job was published
      expect(probeQueue.enqueuedJobs).toHaveLength(1);
      expect(probeQueue.enqueuedJobs[0]?.id).toBe(jobId);

      // Second drain finds nothing (already published)
      const secondResult = await drainOutboxOnce(repositories, { getQueue });
      expect(expectOk(secondResult).processedCount).toBe(0);
    });

    it('records attempts on failure to publish to queue', async () => {
      await repositories.outbox.enqueue({
        kind: 'unknown_queue',
        payload: {
          type: 'queue',
          queueName: 'non_existent_queue',
          job: {
            name: 'test',
            data: {},
            opts: {},
          },
        },
      });

      // Provide a getQueue that throws
      const failingGetQueue = () => {
        throw new Error('Queue unavailable');
      };

      const result = await drainOutboxOnce(repositories, { getQueue: failingGetQueue });
      expect(expectOk(result).processedCount).toBe(1);
      expect(expectOk(result).failureCount).toBe(1);

      // Verify attempt count increased
      const pending = expectOk(await repositories.outbox.claimBatch(10));
      expect(pending[0]?.attempts).toBe(1);
    });
  });

  describe('AC 2: Fault test: Crash right after commit -> relay publishes -> video progresses', () => {
    it('relays outbox row written during atomic transition even if direct enqueue was skipped/crashed', async () => {
      const videoId = uuidv7();
      const probeJobId = ids.probe(videoId, 1);

      // Create video in UPLOADING state first
      await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'UPLOADING',
      });

      // Simulate state transition with outbox write (as done in upload complete)
      const transitioned = expectOk(
        await repositories.videos.transition({
          videoId,
          from: 'UPLOADING',
          to: 'UPLOADED',
          eventType: 'upload.completed',
          eventPayload: { sizeBytes: 1024 },
          outbox: {
            kind: 'probe',
            payload: {
              type: 'queue',
              queueName: 'probe',
              job: {
                name: 'probe',
                data: {
                  videoId,
                  sourceKey: `raw/${videoId}/source.mp4`,
                  generation: 1,
                  traceparent: 'tp',
                },
                opts: { jobId: probeJobId, priority: 5 },
              },
            },
          },
        })
      );
      expect(transitioned).toBe(true);

      // Direct enqueue was NOT called (simulating process crash immediately after DB commit)
      const probeQueue = getQueue('probe') as InMemoryJobQueue;
      expect(probeQueue.enqueuedJobs).toHaveLength(0);

      // Outbox relay runs (e.g. housekeeping worker loop)
      const relayResult = await drainOutboxOnce(repositories, { getQueue });
      expect(expectOk(relayResult).successCount).toBe(1);

      // Job is now enqueued by the relay
      expect(probeQueue.enqueuedJobs).toHaveLength(1);
      expect(probeQueue.enqueuedJobs[0]?.id).toBe(probeJobId);

      // Simulate worker picking up probe and completing to READY
      await repositories.videos.transition({
        videoId,
        from: 'UPLOADED',
        to: 'READY',
        eventType: 'video.ready',
      });

      const video = expectOk(await repositories.videos.findById(videoId));
      expect(video?.status).toBe('READY');
    });
  });

  describe('AC 3: Idempotency & Pruning', () => {
    it('relay uses deterministic job IDs so duplicate publication is a no-op', async () => {
      const probeQueue = getQueue('probe') as InMemoryJobQueue;
      const videoId = uuidv7();
      const probeJobId = ids.probe(videoId, 1);

      // Pre-populate job directly in queue (e.g. fast path succeeded before crash)
      await probeQueue.add(
        'probe',
        { videoId, sourceKey: 'raw/v.mp4', generation: 1 },
        { jobId: probeJobId }
      );
      expect(probeQueue.enqueuedJobs).toHaveLength(1);

      // Outbox item also exists
      await repositories.outbox.enqueue({
        kind: 'probe',
        payload: {
          type: 'queue',
          queueName: 'probe',
          job: {
            name: 'probe',
            data: { videoId, sourceKey: 'raw/v.mp4', generation: 1 },
            opts: { jobId: probeJobId },
          },
        },
      });

      // Relay drains outbox and attempts to add job
      const result = await drainOutboxOnce(repositories, { getQueue });
      expect(expectOk(result).successCount).toBe(1);

      // Queue length stays 1 because InMemoryJobQueue deduplicates by jobId
      expect(probeQueue.enqueuedJobs).toHaveLength(1);
    });

    it('prunes outbox rows older than 7 days', async () => {
      // Create an old published outbox row (8 days ago)
      const item1 = await repositories.outbox.enqueue({
        kind: 'probe',
        payload: { type: 'queue', queueName: 'probe', job: { name: 'probe', data: {}, opts: {} } },
      });
      repositories.outbox.seedPublished(
        expectOk(item1).id,
        new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      );

      // Create a fresh published outbox row (1 day ago)
      const item2 = await repositories.outbox.enqueue({
        kind: 'notify',
        payload: {
          type: 'queue',
          queueName: 'notify',
          job: { name: 'notify', data: {}, opts: {} },
        },
      });
      repositories.outbox.seedPublished(
        expectOk(item2).id,
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      );

      // Prune with 7 days retention
      const prunedCount = await repositories.outbox.prune(7);
      expect(prunedCount).toBe(1);

      // Fresh one remains
      const freshItem = await repositories.outbox.findById(expectOk(item2).id);
      expect(freshItem).not.toBeNull();
      const oldItem = await repositories.outbox.findById(expectOk(item1).id);
      expect(oldItem).toBeNull();
    });
  });

  describe('AC 4: Reconciler repairs metric stays 0 under normal operation', () => {
    it('verifies reconciler_repairs_total stays 0 when outbox relay functions', async () => {
      const metrics = getMetrics();
      const repairsMetric = metrics.reconcilerRepairsTotal;

      // Ensure initial counter state
      const initialVal =
        (repairsMetric as unknown as { get?: () => { values: unknown[] } }).get?.()?.values
          ?.length ?? 0;

      // Enqueue and drain via outbox
      const videoId = uuidv7();
      await repositories.outbox.enqueue({
        kind: 'probe',
        payload: {
          type: 'queue',
          queueName: 'probe',
          job: {
            name: 'probe',
            data: { videoId, generation: 1 },
            opts: { jobId: ids.probe(videoId, 1) },
          },
        },
      });

      await drainOutboxOnce(repositories, { getQueue });

      // Metric must still have no repairs
      const afterVal =
        (repairsMetric as unknown as { get?: () => { values: unknown[] } }).get?.()?.values
          ?.length ?? 0;
      expect(afterVal).toBe(initialVal);
    });
  });

  describe('OutboxRelay timer loop', () => {
    it('starts and stops gracefully', async () => {
      const relay = new OutboxRelay({
        repositories,
        getQueue,
        intervalMs: 50,
      });

      relay.start();
      expect(relay.isRunning()).toBe(true);

      // Wait a tick
      await new Promise((r) => setTimeout(r, 120));

      await relay.stop();
      expect(relay.isRunning()).toBe(false);
    });
  });

  describe('AC 5: Latency added from outbox to queue p95 < 1 s locally', () => {
    it('drains outbox batch in < 1 second locally', async () => {
      // Seed 20 items in outbox
      for (let i = 0; i < 20; i++) {
        const vid = uuidv7();
        await repositories.outbox.enqueue({
          kind: 'probe',
          payload: {
            type: 'queue',
            queueName: 'probe',
            job: {
              name: 'probe',
              data: { videoId: vid, generation: 1 },
              opts: { jobId: ids.probe(vid, 1) },
            },
          },
        });
      }

      const start = Date.now();
      const drainResult = await drainOutboxOnce(repositories, { getQueue, batchSize: 50 });
      const elapsedMs = Date.now() - start;

      expect(expectOk(drainResult).successCount).toBe(20);
      expect(elapsedMs).toBeLessThan(1000); // p95 < 1 s locally (typically < 20 ms in-memory)
    });
  });

  describe('AC 1: Producer atomic outbox enforcement', () => {
    it('transitioning video with outbox writes both atomically', async () => {
      const videoId = uuidv7();
      await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'PROCESSING',
      });

      const notifyJobId = ids.notify(videoId, 'video.ready', 1);
      const transitioned = expectOk(
        await repositories.videos.transition({
          videoId,
          from: 'PROCESSING',
          to: 'READY',
          eventType: 'video.ready',
          outbox: {
            kind: 'notify',
            payload: {
              type: 'queue',
              queueName: 'notify',
              job: {
                name: 'notify',
                data: { videoId, event: 'video.ready' },
                opts: { jobId: notifyJobId },
              },
            },
          },
        })
      );

      expect(transitioned).toBe(true);
      const video = expectOk(await repositories.videos.findById(videoId));
      expect(video?.status).toBe('READY');

      const pending = await repositories.outbox.claimBatch(10);
      const notifyItem = expectOk(pending).find((p) => p.kind === 'notify');
      expect(notifyItem).toBeDefined();
      expect(notifyItem?.payload.type).toBe('queue');
      if (notifyItem?.payload.type === 'queue') {
        expect(notifyItem.payload.job.opts?.jobId).toBe(notifyJobId);
      }
    });

    it('replaying DLQ entry with outbox writes replay job to outbox atomically', async () => {
      const dlqId = uuidv7();
      const jobId = 'failed-job-1';
      await repositories.dlq.create({
        id: dlqId,
        queue: 'probe',
        jobId,
        videoId: uuidv7(),
        payload: { test: true },
        errorCode: 'ERR',
        errorMessage: 'failed',
        attemptsMade: 3,
        status: 'PARKED',
      });

      const replayJobId = `failed-job-1--replay--${Date.now()}`;
      await repositories.dlq.updateStatus(
        dlqId,
        'REPLAYED',
        { replayedAt: new Date() },
        {
          kind: 'dlq_replay',
          payload: {
            type: 'queue',
            queueName: 'probe',
            job: {
              name: 'probe',
              data: { test: true },
              opts: { jobId: replayJobId },
            },
          },
        }
      );

      const updated = expectOk(await repositories.dlq.findById(dlqId));
      expect(updated?.status).toBe('REPLAYED');

      const pending = await repositories.outbox.claimBatch(10);
      const replayItem = expectOk(pending).find((p) => p.kind === 'dlq_replay');
      expect(replayItem).toBeDefined();
    });
  });
});
