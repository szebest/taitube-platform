import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { createMetricsRegistry } from '@vp/observability';
import { expectOk } from '@vp/testing/result';
import { InMemoryFlowProducer } from '../../in-memory/in-memory-flow-producer';
import { InMemoryJobQueue } from '../../in-memory/in-memory-job-queue';
import { InMemoryMultipartStorage } from '../../in-memory/in-memory-multipart-storage';
import { InMemoryStorageClient } from '../../in-memory/in-memory-storage-client';
import { InMemorySubscriptionCache } from '../../in-memory/in-memory-subscription-cache';
import { InMemoryViewBuffer } from '../../in-memory/in-memory-view-buffer';
import type { MeteredMultipartStorage } from '../../metered/metered-multipart-storage';
import type { MeteredStorageClient } from '../../metered/metered-storage-client';
import { Adapters } from '../adapter-tokens';
import { registerFamily } from '../in-memory-family';

function family(): Container {
  const c = new Container()
    .provide(Adapters.Config, () => inProcessAppConfig())
    .provide(Adapters.Metrics, () => createMetricsRegistry());
  registerFamily(c);
  return c;
}

describe('in-memory adapter family', () => {
  it('builds multipart over the storage it registered', () => {
    const c = family();

    expect((c.get(Adapters.Storage) as MeteredStorageClient).inner).toBeInstanceOf(
      InMemoryStorageClient
    );
    expect((c.get(Adapters.Multipart) as MeteredMultipartStorage).inner).toBeInstanceOf(
      InMemoryMultipartStorage
    );
    expect(c.get(Adapters.SubscriptionCache)).toBeInstanceOf(InMemorySubscriptionCache);
    expect(c.get(Adapters.ViewBuffer)).toBeInstanceOf(InMemoryViewBuffer);
  });

  it('opens in-memory queues and a flow producer that routes into them', () => {
    const c = family();

    expect(c.get(Adapters.QueueRegistry).get('probe')).toBeInstanceOf(InMemoryJobQueue);
    expect(c.get(Adapters.FlowProducer)).toBeInstanceOf(InMemoryFlowProducer);
  });

  it('closes every resource it built exactly once, in reverse construction order', async () => {
    const c = family();
    const closed: string[] = [];
    const track = (name: string, resource: { close: () => Promise<unknown> }) => {
      const close = resource.close.bind(resource);
      resource.close = vi.fn(async () => {
        closed.push(name);
        return close();
      }) as typeof resource.close;
    };
    track('DbClient', c.get(Adapters.DbClient));
    track('Cache', c.get(Adapters.Cache));
    track('Multipart', c.get(Adapters.Multipart));
    track('Storage', c.get(Adapters.Storage));
    track('QueueRegistry', c.get(Adapters.QueueRegistry));
    track('FlowProducer', c.get(Adapters.FlowProducer));

    expectOk(await c.dispose());
    await c.dispose();

    expect(closed).toEqual([
      'FlowProducer',
      'QueueRegistry',
      'Multipart',
      'Storage',
      'Cache',
      'DbClient',
    ]);
  });
});
