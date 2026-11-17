import { andThen, andThenAsync, err, isOk, map, ok, type Result } from '@kit/result';
import type {
  CreatedWebhookView,
  CreateWebhookBody,
  WebhookListView,
  WebhookTestView,
} from '@vp/api-contracts';
import type { WebhookDispatcher } from '@vp/core/ports';
import type { WebhookRepositoryPort } from '@vp/core/repositories';
import { WEBHOOK_TEST_EVENT, type Webhook } from '@vp/domain';
import {
  type CreateWebhookFailure,
  decideWebhookCreate,
  decideWebhookRemoval,
  type WebhookNotFound,
  webhookNotFound,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { WebhookUrlPolicy } from '@vp/validation';
import { uuidv7 } from 'uuidv7';

export interface WebhookServiceDeps {
  webhooks: WebhookRepositoryPort;
  policy: WebhookUrlPolicy;
  dispatcher: WebhookDispatcher;
  newSecret: () => string;
  now: () => number;
}

/** A creator's outgoing webhooks. The secret leaves only in the response that creates one. */
export class WebhookService {
  constructor(private readonly deps: WebhookServiceDeps) {}

  async create(
    viewer: UserContext,
    body: CreateWebhookBody
  ): Promise<Result<CreatedWebhookView, CreateWebhookFailure | DatabaseUnavailable>> {
    const { webhooks, policy, newSecret, now } = this.deps;

    return andThenAsync(
      await webhooks.listByOwner(viewer.id),
      async (
        held
      ): Promise<Result<CreatedWebhookView, CreateWebhookFailure | DatabaseUnavailable>> => {
        const decided = decideWebhookCreate({
          viewer,
          ...body,
          held: held.length,
          policy,
          id: uuidv7(),
          secret: newSecret(),
          now: new Date(now()),
        });
        return andThenAsync(decided, async (webhook) =>
          map(await webhooks.create(webhook), () => ({
            ...toView(webhook),
            secret: webhook.secret,
          }))
        );
      }
    );
  }

  async list(viewer: UserContext): Promise<Result<WebhookListView, DatabaseUnavailable>> {
    return map(await this.deps.webhooks.listByOwner(viewer.id), (rows) => ({
      items: rows.map(toView),
    }));
  }

  async remove(
    viewer: UserContext,
    webhookId: string
  ): Promise<Result<void, WebhookNotFound | DatabaseUnavailable>> {
    const removed = await this.deps.webhooks.remove(viewer.id, webhookId);
    return andThen(removed, (gone) => decideWebhookRemoval({ webhookId, removed: gone }));
  }

  /** One signed delivery of the test event to one of the caller's webhooks, and what came of it. */
  async test(
    viewer: UserContext,
    webhookId: string
  ): Promise<Result<WebhookTestView, WebhookNotFound | DatabaseUnavailable>> {
    const { webhooks, dispatcher, now } = this.deps;

    return andThenAsync(
      await webhooks.listByOwner(viewer.id),
      async (held): Promise<Result<WebhookTestView, WebhookNotFound>> => {
        const webhook = held.find(({ id }) => id === webhookId);
        if (!webhook) return err(webhookNotFound(webhookId));

        const delivered = await dispatcher.deliver({
          deliveryId: uuidv7(),
          webhook,
          event: WEBHOOK_TEST_EVENT,
          payload: { webhookId, sentAt: new Date(now()).toISOString() },
        });
        if (isOk(delivered)) return ok({ outcome: 'delivered' });
        const { reason, status } = delivered.error;
        return ok({ outcome: 'failed', reason, status: status ?? null });
      }
    );
  }
}

function toView({ id, url, events, createdAt }: Webhook) {
  return { id, url, events, createdAt: createdAt.toISOString() };
}
