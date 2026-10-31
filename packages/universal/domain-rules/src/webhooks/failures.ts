import { ErrorCodes, type Failure } from '@vp/errors';

export type WebhookNotFound = Failure<typeof ErrorCodes.WEBHOOK_NOT_FOUND, { webhookId: string }>;

export type WebhookLimitReached = Failure<
  typeof ErrorCodes.WEBHOOK_LIMIT_REACHED,
  { limit: number }
>;

export function webhookNotFound(webhookId: string): WebhookNotFound {
  return { code: ErrorCodes.WEBHOOK_NOT_FOUND, message: 'Webhook not found', webhookId };
}

export function webhookLimitReached(limit: number): WebhookLimitReached {
  return {
    code: ErrorCodes.WEBHOOK_LIMIT_REACHED,
    message: `At most ${limit} webhooks can be registered`,
    limit,
  };
}
