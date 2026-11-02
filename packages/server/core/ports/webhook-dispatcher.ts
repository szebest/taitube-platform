import type { Webhook, WebhookEvent } from '@vp/domain';
import type { WebhookDeliveryFailure } from '@vp/errors';
import type { Result } from '@vp/result';

export interface WebhookDelivery {
  /** One per attempt; the receiver can use it, sent also as `Idempotency-Key`, to drop a repeat. */
  readonly deliveryId: string;
  readonly webhook: Pick<Webhook, 'id' | 'url' | 'secret'>;
  readonly event: WebhookEvent;
  /** The JSON body, which the dispatcher signs as sent. */
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * Sends one signed delivery to one receiver, once. A failure is returned for the caller to log and
 * drop: a receiver that is down never costs the pipeline a job.
 */
export abstract class WebhookDispatcher {
  abstract deliver(delivery: WebhookDelivery): Promise<Result<void, WebhookDeliveryFailure>>;
}
