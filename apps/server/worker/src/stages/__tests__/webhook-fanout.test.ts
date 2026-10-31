import { InMemoryRepositories, InMemoryWebhookDispatcher } from '@vp/adapters/in-memory';
import { webhookDeliveryFailed } from '@vp/errors';
import { createLogger } from '@vp/logger';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { createWebhookFanout } from '../webhook-fanout';

const OWNER = uuidv7();
const logger = createLogger({ format: 'json', service: 'fanout-spec', level: 'silent' });

function webhook(overrides: { ownerId?: string; events?: Array<'video.ready' | 'live.started'> }) {
  return {
    id: uuidv7(),
    ownerId: OWNER,
    url: 'https://hooks.example.com/in',
    events: ['video.ready' as const],
    secret: 'secret',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('apps/server/worker/stages: webhook fan-out', () => {
  it('delivers to the owner webhooks subscribed to the event and to no one else', async () => {
    const repositories = new InMemoryRepositories();
    const dispatcher = new InMemoryWebhookDispatcher();
    const subscribed = webhook({});
    for (const row of [
      subscribed,
      webhook({ events: ['live.started'] }),
      webhook({ ownerId: uuidv7() }),
    ]) {
      expectOk(await repositories.webhooks.create(row));
    }

    await createWebhookFanout({ webhooks: repositories.webhooks, dispatcher, logger })(
      OWNER,
      'video.ready',
      { videoId: 'v1' }
    );

    expect(dispatcher.deliveries).toEqual([
      {
        deliveryId: expect.any(String),
        webhook: subscribed,
        event: 'video.ready',
        payload: { videoId: 'v1' },
      },
    ]);
  });

  it('drops a failed delivery without throwing', async () => {
    const repositories = new InMemoryRepositories();
    const dispatcher = new InMemoryWebhookDispatcher();
    const row = webhook({});
    expectOk(await repositories.webhooks.create(row));
    vi.spyOn(dispatcher, 'deliver').mockResolvedValue(
      err(webhookDeliveryFailed(row.id, 'timeout'))
    );

    await expect(
      createWebhookFanout({ webhooks: repositories.webhooks, dispatcher, logger })(
        OWNER,
        'video.ready',
        {}
      )
    ).resolves.toBeUndefined();
  });
});
