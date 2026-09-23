import { InMemoryJobQueue } from '@vp/adapters';
import type { JobQueue } from '@vp/core/ports';
import { ErrorCodes, queueUnavailable } from '@vp/errors';
import { QUEUES } from '@vp/job-contracts';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { QueueService } from '../queue-service';

function serviceWith(...names: string[]): { service: QueueService; queues: InMemoryJobQueue[] } {
  const queues = names.map((name) => new InMemoryJobQueue(name));
  const registry = new Map<string, JobQueue>(queues.map((queue, i) => [names[i] as string, queue]));
  return { service: new QueueService({ queues: registry }), queues };
}

describe('apps/api: QueueService', () => {
  it.each([
    { scenario: 'a registered queue', name: 'probe', found: true },
    { scenario: 'an unknown queue', name: 'nonexistent', found: false },
  ])('looks up $scenario', ({ name, found }) => {
    const { service, queues } = serviceWith('probe');

    expect(service.getQueue(name)).toBe(found ? queues[0] : undefined);
  });

  it('reports counts for every known queue, zeroed for the ones not registered', async () => {
    const { service, queues } = serviceWith('transcode-1080p');
    await queues[0]?.add('test-job', { foo: 'bar' });

    const metrics = expectOk(await service.getQueueMetrics());

    expect(metrics).toHaveLength(QUEUES.length);
    expect(metrics.find((m) => m.name === 'transcode-1080p')?.counts.waiting).toBe(1);
    expect(metrics.find((m) => m.name === 'probe')?.counts.active).toBe(0);
  });

  it('never reports zeroes for a registered queue whose port cannot answer', async () => {
    const stub = {
      getName: () => 'probe',
      isPaused: async () => err(queueUnavailable('isPaused')),
    } as unknown as JobQueue;
    const service = new QueueService({ queues: new Map<string, JobQueue>([['probe', stub]]) });

    expect(expectErr(await service.getQueueMetrics()).code).toBe(ErrorCodes.QUEUE_UNAVAILABLE);
  });

  it('pauses and resumes a registered queue', async () => {
    const { service, queues } = serviceWith('package');

    const queue = queues[0] as InMemoryJobQueue;

    await service.pauseQueue('package');
    expect(expectOk(await queue.isPaused())).toBe(true);

    await service.resumeQueue('package');
    expect(expectOk(await queue.isPaused())).toBe(false);
  });

  it.each([{ method: 'pauseQueue' as const }, { method: 'resumeQueue' as const }])(
    '$method reports an unknown queue rather than throwing',
    async ({ method }) => {
      const { service } = serviceWith();

      const refused = expectErr(await service[method]('invalid-queue'));
      expect(refused.code).toBe(ErrorCodes.INTERNAL);
      expect(refused.message).toContain('invalid-queue');
    }
  );

  it('builds the Bull Board plugin over whatever queues are registered', () => {
    const { service } = serviceWith('probe');

    expect(typeof service.getBoardPlugin('/admin/queues')).toBe('function');
  });
});
