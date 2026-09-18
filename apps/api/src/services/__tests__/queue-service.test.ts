import { InMemoryJobQueue } from '@vp/adapters';
import type { JobQueue } from '@vp/core/ports';
import { QUEUES } from '@vp/job-contracts';
import { describe, expect, it } from 'vitest';
import { QueueService } from '../queue-service';

describe('QueueService', () => {
  it('returns undefined when queue does not exist', () => {
    const service = new QueueService();
    expect(service.getQueue('nonexistent')).toBeUndefined();
  });

  it('retrieves registered queue instance', () => {
    const queues = new Map<string, JobQueue>();
    const mock = new InMemoryJobQueue('probe');
    queues.set('probe', mock);

    const service = new QueueService({ queues });
    expect(service.getQueue('probe')).toBe(mock);
  });

  it('collects metrics across all known queues', async () => {
    const queues = new Map<string, JobQueue>();
    const q1080 = new InMemoryJobQueue('transcode-1080p');
    await q1080.add('test-job', { foo: 'bar' });
    queues.set('transcode-1080p', q1080);

    const service = new QueueService({ queues });
    const metrics = await service.getQueueMetrics();

    expect(metrics.length).toBe(QUEUES.length);
    const item1080 = metrics.find((m) => m.name === 'transcode-1080p');
    expect(item1080).toBeDefined();
    expect(item1080?.counts.waiting).toBe(1);

    const emptyQueue = metrics.find((m) => m.name === 'probe');
    expect(emptyQueue?.counts.active).toBe(0);
  });

  it('pauses and resumes registered queue', async () => {
    const queues = new Map<string, JobQueue>();
    const mock = new InMemoryJobQueue('package');
    queues.set('package', mock);

    const service = new QueueService({ queues });

    await service.pauseQueue('package');
    expect(await mock.isPaused()).toBe(true);

    await service.resumeQueue('package');
    expect(await mock.isPaused()).toBe(false);
  });

  it('throws PermanentError when pausing non-existent queue', async () => {
    const service = new QueueService();
    await expect(service.pauseQueue('invalid-queue')).rejects.toThrow(
      'Queue "invalid-queue" not found'
    );
  });

  it('creates Bull Board Fastify plugin without error', () => {
    const queues = new Map<string, JobQueue>();
    queues.set('probe', new InMemoryJobQueue('probe'));

    const service = new QueueService({ queues });
    const plugin = service.getBoardPlugin('/admin/queues');
    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe('function');
  });
});
