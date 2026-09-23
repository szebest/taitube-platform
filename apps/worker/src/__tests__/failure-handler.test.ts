import {
  InMemoryDlqRepository,
  InMemoryJobQueue,
  InMemoryRepositories,
} from '@vp/adapters/in-memory';
import type { QueueJob, QueueJobOptions } from '@vp/core/ports';
import type { DlqEntryRecord, NewDlqEntryInput, Repositories } from '@vp/core/repositories';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  PermanentError,
  type QueueUnavailable,
  databaseUnavailable,
  queueUnavailable,
} from '@vp/errors';
import type { Logger } from '@vp/observability';
import { type Result, err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { createFailureHandler } from '../failure-handler';
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
  let repositories: InMemoryRepositories;
  let queues: Map<string, InMemoryJobQueue>;
  let lines: LogLine[];

  const getQueue = (name: string): InMemoryJobQueue => {
    let queue = queues.get(name);
    if (!queue) {
      queue = new InMemoryJobQueue(name);
      queues.set(name, queue);
    }
    return queue;
  };

  const handlerOver = (overrides: Partial<Repositories> = {}, stage = QUEUE_NAME) =>
    createFailureHandler({
      workerId: STAGE_SETTINGS.workerId,
      stage,
      queueName: stage,
      repositories: { ...repositories, ...overrides },
      getQueue,
      logger: recordingLogger(lines),
      metrics: STAGE_SETTINGS.metrics,
    });

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    queues = new Map();
    lines = [];
  });

  it('parks the failed job in dlq_entries and enqueues its copy', async () => {
    await handlerOver()(JOB, FAILURE());

    const entries = expectOk(await repositories.dlq.list({ limit: 10 }));
    expect(entries).toHaveLength(1);
    expect(entries[0]?.errorCode).toBe(ErrorCodes.CORRUPT_CONTAINER);
    expect(getQueue('dlq').enqueuedJobs).toHaveLength(1);
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
        queues.set('dlq', new UnreachableQueue('dlq'));
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
});
