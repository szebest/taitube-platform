import { expectOk } from '@vp/testing/result';
import { InMemoryWebhookDispatcher } from '../in-memory-webhook-dispatcher';

const delivery = {
  deliveryId: 'd-1',
  webhook: { id: 'w-1', url: 'https://hooks.example.com/in', secret: 'whsec' },
  event: 'video.ready' as const,
  payload: { videoId: 'v1' },
};

describe('adapters/in-memory: InMemoryWebhookDispatcher', () => {
  it('accepts a delivery and keeps it', async () => {
    const dispatcher = new InMemoryWebhookDispatcher();

    expectOk(await dispatcher.deliver(delivery));

    expect(dispatcher.deliveries).toEqual([delivery]);
  });

  it('forgets what it kept once cleared', async () => {
    const dispatcher = new InMemoryWebhookDispatcher();
    await dispatcher.deliver(delivery);

    dispatcher.clear();

    expect(dispatcher.deliveries).toEqual([]);
  });
});
