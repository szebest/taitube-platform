import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import type { JobQueue } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import { defaultPaginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { DlqService } from '../dlq-service';

const ADMIN: UserContext = { id: '00000000-0000-7000-8000-000000000003', role: 'ADMIN' };

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
      paginator: defaultPaginator,
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

    const result = expectOk(await dlqService.list(ADMIN, {}));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.jobId).toBe('job-1');
  });

  it('replays a dead-letter job and records event', async () => {
    const entry = expectOk(
      await repositories.dlq.create({
        id: '018f0000-0000-7000-8000-000000000002',
        queue: 'probe',
        jobId: 'vid-1--probe--g1',
        videoId: '018f0000-0000-7000-8000-000000000099',
        payload: { videoId: 'vid-1' },
        attemptsMade: 3,
        status: 'PARKED',
      })
    );

    const replayResult = expectOk(await dlqService.replay(ADMIN, entry.id));
    expect(replayResult.status).toBe('REPLAYED');
    expect(replayResult.dlqEntryId).toBe(entry.id);
    expect(replayResult.replayJobId).toMatch(/--r1$/);

    expect(expectOk(await repositories.dlq.findById(entry.id))?.status).toBe('REPLAYED');
  });

  it('discards a dead-letter job', async () => {
    const entry = expectOk(
      await repositories.dlq.create({
        id: '018f0000-0000-7000-8000-000000000003',
        queue: 'probe',
        jobId: 'job-discard',
        payload: {},
        attemptsMade: 3,
        status: 'PARKED',
      })
    );

    expectOk(await dlqService.discard(ADMIN, entry.id));
    expect(expectOk(await repositories.dlq.findById(entry.id))?.status).toBe('DISCARDED');
  });

  it('reports DLQ_ENTRY_NOT_FOUND when the entry does not exist', async () => {
    const replayed = await dlqService.replay(ADMIN, '018f0000-0000-7000-8000-000000000999');

    expect(expectErr(replayed).code).toBe(ErrorCodes.DLQ_ENTRY_NOT_FOUND);
  });

  it.each([
    { scenario: 'an anonymous caller', caller: null, code: ErrorCodes.UNAUTHORIZED },
    {
      scenario: 'a signed-in non-admin',
      caller: { id: 'user-1', role: 'USER' } as UserContext,
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $scenario', async ({ caller, code }) => {
    expect(expectErr(await dlqService.list(caller, {})).code).toBe(code);
    expect(expectErr(await dlqService.replay(caller, 'any')).code).toBe(code);
    expect(expectErr(await dlqService.discard(caller, 'any')).code).toBe(code);
  });
});
