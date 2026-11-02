import type { Webhook, WebhookEvent } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * Every read and delete but the dispatch lookup is keyed by the owner's id, so another user's
 * webhook is never reachable. Rows carry their secret: the API drops it from every view, and the
 * dispatcher is the one reader that signs with it.
 */
export interface WebhookRepositoryPort {
  create(webhook: Webhook): Promise<Result<void, DatabaseUnavailable>>;
  /** Oldest first. */
  listByOwner(ownerId: string): Promise<Result<Webhook[], DatabaseUnavailable>>;
  /** The owner's webhooks subscribed to `event`, oldest first. */
  listSubscribed(
    ownerId: string,
    event: WebhookEvent
  ): Promise<Result<Webhook[], DatabaseUnavailable>>;
  /** `false` when the owner has no such webhook. */
  remove(ownerId: string, id: string): Promise<Result<boolean, DatabaseUnavailable>>;
}
