import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters';
import type { JobQueue } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import { DlqService } from '../dlq-service';

describe('DlqService', () => {
  let repositories: InMemoryRepositories;
  let queues: Map<string, JobQueue>;
  let dlqService: DlqService;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    repositories.clear();
    queues = new Map<string, JobQueue>();
    queues.set('probe', new InMemoryJobQueue('probe'));
    dlqService = new DlqService({
      dlq: repositories.dlq,
      events: repositories.events,
      queues,
    });
  });

  it('lists DLQ entries with pagination and filter', async () => {
    await repositories.dlq.create({
      id: '018f0000-0000-7000-8000-000000000001',
      queue: 'probe',
      jobId: 'job-1',
      payload: { test: true },
      attemptsMade: 3,
      status: 'PARKED',
    });

    const result = await dlqService.list({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.jobId).toBe('job-1');
  });

  it('replays a dead-letter job and records event', async () => {
    const entry = await repositories.dlq.create({
      id: '018f0000-0000-7000-8000-000000000002',
      queue: 'probe',
      jobId: 'vid-1--probe--g1',
      videoId: '018f0000-0000-7000-8000-000000000099',
      payload: { videoId: 'vid-1' },
      attemptsMade: 3,
      status: 'PARKED',
    });

    const replayResult = await dlqService.replay(entry.id);
    expect(replayResult.status).toBe('REPLAYED');
    expect(replayResult.dlqEntryId).toBe(entry.id);
    expect(replayResult.replayJobId).toMatch(/--r1$/);

    const updated = await repositories.dlq.findById(entry.id);
    expect(updated?.status).toBe('REPLAYED');
  });

  it('discards a dead-letter job', async () => {
    const entry = await repositories.dlq.create({
      id: '018f0000-0000-7000-8000-000000000003',
      queue: 'probe',
      jobId: 'job-discard',
      payload: {},
      attemptsMade: 3,
      status: 'PARKED',
    });

    await dlqService.discard(entry.id);
    const updated = await repositories.dlq.findById(entry.id);
    expect(updated?.status).toBe('DISCARDED');
  });

  it('throws DLQ_ENTRY_NOT_FOUND when entry does not exist', async () => {
    await expect(dlqService.replay('018f0000-0000-7000-8000-000000000999')).rejects.toThrowError(
      expect.objectContaining({
        code: ErrorCodes.DLQ_ENTRY_NOT_FOUND,
      })
    );
  });
});
