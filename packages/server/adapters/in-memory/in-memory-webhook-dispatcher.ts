import { type WebhookDelivery, WebhookDispatcher } from '@vp/core/ports';
import type { WebhookDeliveryFailure } from '@vp/errors';
import { ok, type Result } from '@vp/result';

/** Accepts every delivery and keeps it, so a spec or a local run can see what would have been sent. */
export class InMemoryWebhookDispatcher extends WebhookDispatcher {
  readonly deliveries: WebhookDelivery[] = [];

  async deliver(delivery: WebhookDelivery): Promise<Result<void, WebhookDeliveryFailure>> {
    this.deliveries.push(delivery);
    return ok();
  }

  clear(): void {
    this.deliveries.length = 0;
  }
}
