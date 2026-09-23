import { expectOk } from '@vp/testing/result';
import { InMemoryJobQueue } from '../../in-memory/in-memory-job-queue';
import { LazyQueueRegistry } from '../queue-registry';

describe('LazyQueueRegistry', () => {
  it('opens a queue on first use and hands the same one back after that', () => {
    const open = vi.fn((name: string) => new InMemoryJobQueue(name));
    const registry = new LazyQueueRegistry(open);

    expect(registry.get('probe')).toBe(registry.get('probe'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('closes exactly the queues it opened', async () => {
    const probe = new InMemoryJobQueue('probe');
    const close = vi.spyOn(probe, 'close');
    const open = vi.fn(() => probe);
    const registry = new LazyQueueRegistry(open);
    registry.get('probe');

    expectOk(await registry.close());

    expect(close).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
