import { channels, users } from '@vp/db';
import type { CreateChannelInput } from '@vp/domain';
import { and, eq, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { PostgresDatabase } from './types';

type ChannelRow = typeof channels.$inferSelect;

export function newChannelRow(input: CreateChannelInput, isPrimary: boolean) {
  return {
    id: input.id ?? uuidv7(),
    userId: input.userId,
    isPrimary,
    handle: input.handle.toLowerCase(),
    displayName: input.displayName,
    avatarUrl: input.avatarUrl ?? null,
    bannerUrl: input.bannerUrl ?? null,
    brandColor: input.brandColor ?? null,
    bio: input.bio ?? null,
    subscriberCount: input.subscriberCount ?? 0,
  } satisfies typeof channels.$inferInsert;
}

/** Holds the owner's `users` row for the transaction, so one user's channel writes run one at a time. */
async function lockOwner(tx: PostgresDatabase, userId: string): Promise<void> {
  await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
}

/**
 * Counting under the owner's lock is what keeps the limit: a bare count under READ COMMITTED lets
 * two concurrent inserts both see room for one more.
 */
export function insertOwnedChannel(
  db: PostgresDatabase,
  input: CreateChannelInput,
  limit: number
): Promise<'limit' | ChannelRow> {
  return db.transaction(async (tx) => {
    await lockOwner(tx, input.userId);
    const [held] = await tx
      .select({
        owned: sql<number>`count(*)`.mapWith(Number),
        primaries: sql<number>`count(*) filter (where ${channels.isPrimary})`.mapWith(Number),
      })
      .from(channels)
      .where(eq(channels.userId, input.userId));
    if ((held?.owned ?? 0) >= limit) return 'limit';

    const [row] = await tx
      .insert(channels)
      .values(newChannelRow(input, (held?.primaries ?? 0) === 0))
      .returning();
    if (!row) throw new Error('channel insert returned no row');
    return row;
  });
}

/** The old primary steps down before the new one rises: the partial unique index checks each statement. */
export function promoteChannel(
  db: PostgresDatabase,
  userId: string,
  channelId: string
): Promise<ChannelRow | undefined> {
  return db.transaction(async (tx) => {
    await lockOwner(tx, userId);
    const owned = and(eq(channels.id, channelId), eq(channels.userId, userId));
    const [target] = await tx.select({ id: channels.id }).from(channels).where(owned);
    if (!target) return undefined;

    await tx
      .update(channels)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(and(eq(channels.userId, userId), eq(channels.isPrimary, true)));
    const [row] = await tx
      .update(channels)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(owned)
      .returning();
    return row;
  });
}
