import { InMemoryJobQueue } from '@vp/adapters';
import type { JobQueue } from '@vp/core/ports';
import { QUEUES } from '@vp/job-contracts';
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

    const metrics = await service.getQueueMetrics();

    expect(metrics).toHaveLength(QUEUES.length);
    expect(metrics.find((m) => m.name === 'transcode-1080p')?.counts.waiting).toBe(1);
    expect(metrics.find((m) => m.name === 'probe')?.counts.active).toBe(0);
  });

  it('pauses and resumes a registered queue', async () => {
    const { service, queues } = serviceWith('package');

    await service.pauseQueue('package');
    expect(await queues[0]?.isPaused()).toBe(true);

    await service.resumeQueue('package');
    expect(await queues[0]?.isPaused()).toBe(false);
  });

  it.each([{ method: 'pauseQueue' as const }, { method: 'resumeQueue' as const }])(
    '$method rejects an unknown queue',
    async ({ method }) => {
      const { service } = serviceWith();

      await expect(service[method]('invalid-queue')).rejects.toThrow(
        'Queue "invalid-queue" not found'
      );
    }
  );

  it('builds the Bull Board plugin over whatever queues are registered', () => {
    const { service } = serviceWith('probe');

    expect(typeof service.getBoardPlugin('/admin/queues')).toBe('function');
  });
});
