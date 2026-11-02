import type { WebhookDispatcher } from '@vp/core/ports';
import type { WebhookRepositoryPort } from '@vp/core/repositories';
import type { WebhookEvent } from '@vp/domain';
import type { Logger } from '@vp/logger';
import { isErr } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export interface WebhookFanoutDeps {
  webhooks: WebhookRepositoryPort;
  dispatcher: WebhookDispatcher;
  logger: Logger;
}

/**
 * Tells every webhook of `ownerId` that subscribed to `event`. A receiver that is down or a store
 * that cannot be read is logged and dropped: it never fails the job that announced the event.
 */
export function createWebhookFanout({ webhooks, dispatcher, logger }: WebhookFanoutDeps) {
  return async function announce(
    ownerId: string,
    event: WebhookEvent,
    payload: Readonly<Record<string, unknown>>
  ): Promise<void> {
    const subscribed = await webhooks.listSubscribed(ownerId, event);
    if (isErr(subscribed)) {
      logger.warn({ ownerId, event, failure: subscribed.error.code }, 'webhook lookup failed');
      return;
    }

    await Promise.all(
      subscribed.value.map(async (webhook) => {
        const delivered = await dispatcher.deliver({
          deliveryId: uuidv7(),
          webhook,
          event,
          payload,
        });
        if (isErr(delivered)) {
          logger.warn(
            { webhookId: webhook.id, event, failure: delivered.error },
            'webhook delivery failed'
          );
        }
      })
    );
  };
}
