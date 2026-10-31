import { createHmac } from 'node:crypto';
import type { WebhookDelivery } from '@vp/core/ports';
import { WebhookDispatcher } from '@vp/core/ports';
import {
  type WebhookDeliveryFailure,
  webhookDeliveryFailed,
  webhookDeliveryRejected,
} from '@vp/errors';
import { err, isErr, ok, type Result } from '@vp/result';
import { validateWebhookUrl } from '@vp/validation';

export interface HttpWebhookDispatcherConfig {
  timeoutMs: number;
  allowPrivateHosts: boolean;
}

/** The signature a receiver recomputes: HMAC-SHA256 of `<timestamp>.<body>` under the webhook secret. */
function signWebhookBody(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

/**
 * One POST per delivery: the timeout bounds it, a redirect is not followed, and a 5xx or 429 is
 * the receiver's to recover from while any other non-2xx is not.
 */
export class HttpWebhookDispatcher extends WebhookDispatcher {
  constructor(
    private readonly config: HttpWebhookDispatcherConfig,
    private readonly send: typeof fetch,
    private readonly now: () => number
  ) {
    super();
  }

  async deliver(delivery: WebhookDelivery): Promise<Result<void, WebhookDeliveryFailure>> {
    const { webhook, event, deliveryId, payload } = delivery;
    const { timeoutMs, allowPrivateHosts } = this.config;

    const target = validateWebhookUrl(webhook.url, { allowPrivateHosts });
    if (isErr(target)) return err(webhookDeliveryRejected(webhook.id, 'blocked-host'));

    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(this.now() / 1000));

    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await this.send(target.value, {
        method: 'POST',
        redirect: 'manual',
        signal,
        headers: {
          'content-type': 'application/json',
          'x-taitube-event': event,
          'x-taitube-delivery': deliveryId,
          'idempotency-key': deliveryId,
          'x-taitube-timestamp': timestamp,
          'x-taitube-signature-256': signWebhookBody(webhook.secret, timestamp, body),
        },
        body,
      });
      return this.classify(webhook.id, response.status);
    } catch {
      return err(webhookDeliveryFailed(webhook.id, signal.aborted ? 'timeout' : 'network'));
    }
  }

  private classify(webhookId: string, status: number): Result<void, WebhookDeliveryFailure> {
    if (status >= 200 && status < 300) return ok();
    if (status >= 300 && status < 400)
      return err(webhookDeliveryRejected(webhookId, 'redirect', status));
    if (status === 429 || status >= 500)
      return err(webhookDeliveryFailed(webhookId, 'status', status));
    return err(webhookDeliveryRejected(webhookId, 'status', status));
  }
}
