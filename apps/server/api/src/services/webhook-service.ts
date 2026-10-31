import type { CreatedWebhookView, CreateWebhookBody, WebhookListView } from '@vp/api-contracts';
import type { WebhookRepositoryPort } from '@vp/core/repositories';
import type { Webhook } from '@vp/domain';
import {
  type CreateWebhookFailure,
  decideWebhookCreate,
  decideWebhookRemoval,
  type WebhookNotFound,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { andThen, andThenAsync, map, type Result } from '@vp/result';
import type { WebhookUrlPolicy } from '@vp/validation';
import { uuidv7 } from 'uuidv7';

export interface WebhookServiceDeps {
  webhooks: WebhookRepositoryPort;
  policy: WebhookUrlPolicy;
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
}

function toView({ id, url, events, createdAt }: Webhook) {
  return { id, url, events, createdAt: createdAt.toISOString() };
}
