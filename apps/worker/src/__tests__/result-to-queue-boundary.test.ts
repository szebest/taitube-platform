import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import { type AnyFailure, ErrorCodes, storageUnavailable, toPipelineError } from '@vp/errors';
import { createMetricsRegistry } from '@vp/observability';
import { createLogger } from '@vp/logger';
import { type Result, err, isErr, ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { createFailureHandler } from '../failure-handler';
import { STAGE_SETTINGS } from './stage-settings';

const logger = createLogger({ format: 'json', service: 'queue-boundary-test', level: 'error' });
const metrics = createMetricsRegistry();

const corruptContainer = {
  code: ErrorCodes.CORRUPT_CONTAINER,
  message: 'moov atom not found',
} as const;

/** The exact line `runner.ts` runs on every job outcome. */
function runnerOutcome(outcome: Result<unknown, AnyFailure>): Error | null {
  return isErr(outcome) ? toPipelineError(outcome.error) : null;
}

describe('the worker edge: a stage Result becomes the queue throw', () => {
  let repositories: InMemoryRepositories;
  let queues: Map<string, InMemoryJobQueue>;

  const getQueue = (name: string): InMemoryJobQueue => {
    const existing = queues.get(name);
    if (existing) return existing;
    const created = new InMemoryJobQueue(name);
    queues.set(name, created);
    return created;
  };

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    queues = new Map();
  });

  it('lets a stage that succeeded through untouched', () => {
    expect(runnerOutcome(ok({ videoId: 'v1', published: true }))).toBeNull();
  });

  it.each([
    {
      name: 'a permanent failure',
      failure: corruptContainer,
      retryable: false,
      unrecoverable: true,
    },
    {
      name: 'a transient failure',
      failure: storageUnavailable('putObject'),
      retryable: true,
      unrecoverable: false,
    },
  ])(
    '$name reaches the DLQ with the retryability RETRY_CLASS gives its code',
    async ({ failure, retryable, unrecoverable }) => {
      const thrown = runnerOutcome(err(failure));
      if (!thrown) throw new Error('expected the runner to convert the failure');

      expect((thrown as unknown as { isRetryable: boolean }).isRetryable).toBe(retryable);

      const videoId = uuidv7();
      const jobId = `${videoId}--probe--g1`;
      const onFailed = createFailureHandler({
        workerId: STAGE_SETTINGS.workerId,
        stage: 'probe',
        queueName: 'probe',
        repositories,
        getQueue,
        logger,
        metrics,
      });

      await onFailed(
        { id: jobId, name: 'probe', data: { videoId }, attemptsMade: 1 } as never,
        thrown
      );

      const parked = expectOk(await repositories.dlq.list({ limit: 10 }));
      expect(parked[0]).toMatchObject({
        queue: 'probe',
        jobId,
        errorCode: failure.code,
        status: 'PARKED',
      });

      const [copy] = expectOk(await getQueue('dlq').getJobs());
      expect((copy?.data as { error: { unrecoverable: boolean } }).error.unrecoverable).toBe(
        unrecoverable
      );
    }
  );

  it('keeps the failure payload on the DLQ row without leaking the cause', () => {
    const thrown = toPipelineError(storageUnavailable('putObject', new Error('ECONNRESET')));

    expect(thrown.details).toEqual({ operation: 'putObject' });
  });
});
