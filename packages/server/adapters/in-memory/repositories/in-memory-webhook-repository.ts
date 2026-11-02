import type { WebhookRepositoryPort } from '@vp/core/repositories';
import type { Webhook, WebhookEvent } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

const copyOf = (webhook: Webhook): Webhook => ({ ...webhook, events: [...webhook.events] });

const oldestFirst = (a: Webhook, b: Webhook) => a.createdAt.getTime() - b.createdAt.getTime();

export class InMemoryWebhookRepository implements WebhookRepositoryPort {
  private readonly rows = new Map<string, Webhook>();

  async create(webhook: Webhook): Promise<Result<void, DatabaseUnavailable>> {
    this.rows.set(webhook.id, copyOf(webhook));
    return ok();
  }

  async listByOwner(ownerId: string): Promise<Result<Webhook[], DatabaseUnavailable>> {
    return ok(this.of(ownerId).map(copyOf));
  }

  async listSubscribed(
    ownerId: string,
    event: WebhookEvent
  ): Promise<Result<Webhook[], DatabaseUnavailable>> {
    return ok(
      this.of(ownerId)
        .filter((webhook) => webhook.events.includes(event))
        .map(copyOf)
    );
  }

  async remove(ownerId: string, id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const found = this.rows.get(id);
    return ok(found?.ownerId === ownerId ? this.rows.delete(id) : false);
  }

  clear(): void {
    this.rows.clear();
  }

  private of(ownerId: string): Webhook[] {
    return [...this.rows.values()].filter((row) => row.ownerId === ownerId).sort(oldestFirst);
  }
}
