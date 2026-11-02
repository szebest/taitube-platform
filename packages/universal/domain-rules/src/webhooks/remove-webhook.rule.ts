import { type Result, err, ok } from '@vp/result';
import { type WebhookNotFound, webhookNotFound } from './failures';

export interface RemoveWebhookInput {
  readonly webhookId: string;
  /** Whether a webhook of the caller's own went; another user's id deletes nothing, so it is not found. */
  readonly removed: boolean;
}

export function decideWebhookRemoval(input: RemoveWebhookInput): Result<void, WebhookNotFound> {
  return input.removed ? ok() : err(webhookNotFound(input.webhookId));
}
