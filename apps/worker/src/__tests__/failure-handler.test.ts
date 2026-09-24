import { InMemoryDlqRepository, InMemoryJobQueue } from '@vp/adapters/in-memory';
import type { QueueJob, QueueJobOptions } from '@vp/core/ports';
import type { DlqEntryRecord, NewDlqEntryInput, Repositories } from '@vp/core/repositories';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  PermanentError,
  type QueueUnavailable,
  databaseUnavailable,
  TransientError,
  queueUnavailable,
} from '@vp/errors';
import { ids, stagePolicies } from '@vp/job-contracts';
import type { Logger } from '@vp/observability';
import { type Result, err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { createFailureHandler } from '../failure-handler';
import { type FlowWorld, flowWorld, uploadedVideo } from './flow-harness';
import { STAGE_SETTINGS } from './stage-settings';

interface LogLine {
  readonly level: string;
  readonly message: string;
}

function recordingLogger(lines: LogLine[]): Logger {
  const at = (level: string) => (_fields: unknown, message?: string) => {
    lines.push({ level, message: message ?? '' });
  };
  const logger = {
    fatal: at('fatal'),
    error: at('error'),
    warn: at('warn'),
    info: at('info'),
    debug: at('debug'),
    trace: at('trace'),
    child: () => logger,
  };
  return logger as unknown as Logger;
}

class UnreachableDlqRepository extends InMemoryDlqRepository {
  override async create(
    _entry: NewDlqEntryInput
  ): Promise<Result<DlqEntryRecord, DatabaseUnavailable>> {
    return err(databaseUnavailable('create'));
  }
}

class UnreachableQueue extends InMemoryJobQueue {
  override async add<T = unknown>(
    _name: string,
    _data: T,
    _options?: QueueJobOptions
  ): Promise<Result<QueueJob<T>, QueueUnavailable>> {
    return err(queueUnavailable('add'));
  }
}

const QUEUE_NAME = 'transcode-720p';
const JOB: QueueJob<unknown> = {
  id: 'job-1',
  name: QUEUE_NAME,
  data: { videoId: '00000000-0000-7000-8000-0000000000f1' },
  attemptsMade: 1,
};

const FAILURE = (): Error => new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'bad header');

describe('apps/worker: DLQ failure handler', () => {
  let world: FlowWorld;
  let lines: LogLine[];

  const handlerOver = (overrides: Partial<Repositories> = {}, stage = QUEUE_NAME) =>
    createFailureHandler({
      workerId: STAGE_SETTINGS.workerId,
      stage,
      queueName: stage,
      repositories: { ...world.repositories, ...overrides },
      getQueue: world.getQueue,
      logger: recordingLogger(lines),
      metrics: STAGE_SETTINGS.metrics,
    });

  const dlqEntries = async () => expectOk(await world.repositories.dlq.list({ limit: 100 }));

  beforeEach(() => {
    world = flowWorld();
    lines = [];
  });

  it('parks the failed job in dlq_entries and enqueues its copy', async () => {
    await handlerOver()(JOB, FAILURE());

    const entries = await dlqEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.errorCode).toBe(ErrorCodes.CORRUPT_CONTAINER);
    expect(world.getQueue('dlq').enqueuedJobs).toHaveLength(1);
  });

  it.each([
    {
      name: 'an insert a dead database refused',
      overrides: () => ({ dlq: new UnreachableDlqRepository() }),
      stage: QUEUE_NAME,
      message: 'Failed to insert dlq_entries row',
    },
    {
      name: 'a dlq queue that will not take the copy',
      overrides: () => {
        world.queues.set('dlq', new UnreachableQueue('dlq'));
        return {};
      },
      stage: QUEUE_NAME,
      message: 'Failed to add copy of job to dlq queue',
    },
    {
      name: 'an origin queue the job contract does not know',
      overrides: () => ({}),
      stage: 'not-a-queue',
      message: 'Failed to build copy of job for dlq queue',
    },
  ])('logs $name instead of losing it', async ({ overrides, stage, message }) => {
    await handlerOver(overrides(), stage)(JOB, FAILURE());

    expect(lines).toContainEqual({ level: 'error', message });
  });

  it('parks a permanent failure on its first attempt, marking the step DEAD and the rendition FAILED', async () => {
    const videoId = await uploadedVideo(world, 'raw/corrupt.mp4');
    const jobId = `${videoId}--transcode--720p--g1`;
    expectOk(
      await world.repositories.steps.claim({
        id: uuidv7(),
        videoId,
        step: 'transcode',
        rendition: '720p',
        jobId,
        attempt: 1,
        workerId: 'worker-test',
        lockToken: 'token-1',
      })
    );
    expectOk(
      await world.repositories.renditions.create({
        id: uuidv7(),
        videoId,
        name: '720p',
        width: 1280,
        height: 720,
        videoBitrateKbps: 2500,
        audioBitrateKbps: 128,
        status: 'PENDING',
      })
    );
    const queue = world.getQueue(QUEUE_NAME);
    queue.onFailed(handlerOver());
    await queue.add(
      QUEUE_NAME,
      { videoId, rendition: { name: '720p' } },
      {
        jobId,
        ...stagePolicies[QUEUE_NAME],
      }
    );

    const processor = vi.fn(async () => {
      throw new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'Corrupt container header');
    });
    await expect(queue.process(processor)).rejects.toThrow('Corrupt container header');

    expect(processor).toHaveBeenCalledTimes(1);
    const entries = await dlqEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      queue: QUEUE_NAME,
      jobId,
      errorCode: ErrorCodes.CORRUPT_CONTAINER,
      attemptsMade: 1,
      status: 'PARKED',
    });
    const copies = world.getQueue('dlq').enqueuedJobs;
    expect(copies).toHaveLength(1);
    expect(copies[0]?.id).toBe(ids.dlq(QUEUE_NAME, jobId, 1));
    expect(copies[0]?.data).toMatchObject({
      error: { code: ErrorCodes.CORRUPT_CONTAINER, unrecoverable: true },
    });
    const steps = expectOk(await world.repositories.steps.findByVideoId(videoId));
    expect(steps.some((s) => s.step === 'transcode' && s.status === 'DEAD')).toBe(true);
    const renditions = expectOk(await world.repositories.renditions.findByVideoId(videoId));
    expect(renditions.some((r) => r.name === '720p' && r.status === 'FAILED')).toBe(true);
  });

  it.each([
    {
      failure: 'a transient error',
      queueName: 'transcode-480p' as const,
      error: () => new TransientError(ErrorCodes.STORAGE_UNAVAILABLE, 'S3 connection timeout'),
      attempts: 4,
      code: ErrorCodes.STORAGE_UNAVAILABLE,
    },
    {
      failure: 'an unclassified error, capped at 3 under a 5-attempt policy',
      queueName: 'probe' as const,
      error: () => new Error('Uncategorized internal error in processor'),
      attempts: 3,
      code: ErrorCodes.INTERNAL,
    },
  ])('retries $failure up to its attempt limit, then parks it', async (row) => {
    const videoId = await uploadedVideo(world, 'raw/retried.mp4');
    const queue = world.getQueue(row.queueName);
    queue.onFailed(handlerOver({}, row.queueName));
    await queue.add(
      row.queueName,
      { videoId },
      {
        jobId: `${videoId}--${row.queueName}--g1`,
        ...stagePolicies[row.queueName],
      }
    );

    const failure = row.error();
    const processor = vi.fn(async () => {
      throw failure;
    });
    await expect(queue.process(processor)).rejects.toThrow(failure.message);

    expect(processor).toHaveBeenCalledTimes(row.attempts);
    const entries = await dlqEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ attemptsMade: row.attempts, errorCode: row.code });
  });
});
