import { MAX_WEBHOOKS_PER_USER, type Webhook, type WebhookEvent } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type InvalidWebhookUrl, type WebhookUrlPolicy, validateWebhookUrl } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type WebhookLimitReached, webhookLimitReached } from './failures';

export interface CreateWebhookInput {
  readonly viewer: UserContext | null;
  readonly url: string;
  readonly events: readonly WebhookEvent[];
  /** How many webhooks the caller already holds. */
  readonly held: number;
  readonly policy: WebhookUrlPolicy;
  readonly id: string;
  readonly secret: string;
  readonly now: Date;
}

export type CreateWebhookFailure = AuthorizationFailure | InvalidWebhookUrl | WebhookLimitReached;

/** Any signed-in user may register their own webhooks; the cap and the URL are what can refuse. */
export function decideWebhookCreate(
  input: CreateWebhookInput
): Result<Webhook, CreateWebhookFailure> {
  const { viewer, url, events, held, policy, id, secret, now } = input;

  return andThen(
    authorize(viewer, true, { action: 'create', subject: 'Webhook' }),
    (owner): Result<Webhook, CreateWebhookFailure> => {
      if (held >= MAX_WEBHOOKS_PER_USER) return err(webhookLimitReached(MAX_WEBHOOKS_PER_USER));
      return andThen(validateWebhookUrl(url, policy), (checked) =>
        ok({
          id,
          ownerId: owner.id,
          url: checked,
          events: [...new Set(events)],
          secret,
          createdAt: now,
        })
      );
    }
  );
}
