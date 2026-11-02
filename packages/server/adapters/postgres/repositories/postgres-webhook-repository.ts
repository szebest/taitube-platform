import type { WebhookRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { Webhook, WebhookEvent } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { webhooks: w } = schema;

export class PostgresWebhookRepository implements WebhookRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async create(webhook: Webhook): Promise<Result<void, DatabaseUnavailable>> {
    const written = await fromPromise(
      () => this.db.insert(w).values(webhook),
      databaseUnavailable.during('createWebhook')
    );
    return map(written, () => undefined);
  }

  async listByOwner(ownerId: string): Promise<Result<Webhook[], DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.select().from(w).where(eq(w.ownerId, ownerId)).orderBy(asc(w.createdAt), asc(w.id)),
      databaseUnavailable.during('listWebhooks')
    );
  }

  async listSubscribed(
    ownerId: string,
    event: WebhookEvent
  ): Promise<Result<Webhook[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(w)
          .where(and(eq(w.ownerId, ownerId), sql`${event} = any(${w.events})`))
          .orderBy(asc(w.createdAt), asc(w.id)),
      databaseUnavailable.during('listSubscribedWebhooks')
    );
  }

  async remove(ownerId: string, id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .delete(w)
          .where(and(eq(w.ownerId, ownerId), eq(w.id, id)))
          .returning({ id: w.id }),
      databaseUnavailable.during('removeWebhook')
    );
    return map(rows, (removed) => removed.length > 0);
  }
}
