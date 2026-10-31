import { ErrorCodes } from './error-codes';
import type { Failure } from './failure';

/** The receiver may recover: it did not answer in time, was unreachable, or answered 5xx or 429. */
export type WebhookDeliveryFailed = Failure<
  typeof ErrorCodes.WEBHOOK_DELIVERY_FAILED,
  { webhookId: string; reason: 'timeout' | 'network' | 'status'; status?: number }
>;

/** Sending again changes nothing: the host is not allowed, the receiver redirected, or it answered 4xx. */
export type WebhookDeliveryRejected = Failure<
  typeof ErrorCodes.WEBHOOK_DELIVERY_REJECTED,
  { webhookId: string; reason: 'blocked-host' | 'redirect' | 'status'; status?: number }
>;

export type WebhookDeliveryFailure = WebhookDeliveryFailed | WebhookDeliveryRejected;

export function webhookDeliveryFailed(
  webhookId: string,
  reason: WebhookDeliveryFailed['reason'],
  status?: number
): WebhookDeliveryFailed {
  return {
    code: ErrorCodes.WEBHOOK_DELIVERY_FAILED,
    message: `Webhook delivery failed: ${reason}`,
    webhookId,
    reason,
    ...(status === undefined ? {} : { status }),
  };
}

export function webhookDeliveryRejected(
  webhookId: string,
  reason: WebhookDeliveryRejected['reason'],
  status?: number
): WebhookDeliveryRejected {
  return {
    code: ErrorCodes.WEBHOOK_DELIVERY_REJECTED,
    message: `Webhook delivery rejected: ${reason}`,
    webhookId,
    reason,
    ...(status === undefined ? {} : { status }),
  };
}
