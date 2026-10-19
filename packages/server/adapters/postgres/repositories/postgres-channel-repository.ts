import type { ChannelRepositoryPort } from '@vp/core/repositories';
import { channels } from '@vp/db';
import type { Channel, CreateChannelInput, UpdateChannelInput } from '@vp/domain';
import {
  type DatabaseUnavailable,
  type HandleTaken,
  databaseUnavailable,
  handleTaken,
} from '@vp/errors';
import { type Result, err, fromPromise, map, ok } from '@vp/result';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { isUniqueViolation } from '../pg-errors';
import { channelColumns, toChannel } from './channel-query';
import type { PostgresDatabase } from './types';

export class PostgresChannelRepository implements ChannelRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  /** `channels` is unique on both `handle` and `user_id`; either collision is a taken handle. */
  private conflict(handle: string, operation: string) {
    return (cause: unknown): DatabaseUnavailable | HandleTaken =>
      isUniqueViolation(cause) ? handleTaken(handle) : databaseUnavailable(operation, cause);
  }

  private async findOneBy(
    column: (typeof channels)['id' | 'userId' | 'handle'],
    value: string,
    operation: string
  ): Promise<Result<Channel | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select(channelColumns).from(channels).where(eq(column, value)).limit(1),
      databaseUnavailable.during(operation)
    );

    return map(rows, ([row]) => (row ? toChannel(row) : null));
  }

  findById(id: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    return this.findOneBy(channels.id, id, 'findById');
  }

  findByUserId(userId: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    return this.findOneBy(channels.userId, userId, 'findByUserId');
  }

  async findByUserIds(userIds: readonly string[]): Promise<Result<Channel[], DatabaseUnavailable>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) {
      return ok([]);
    }

    const rows = await fromPromise(
      () => this.db.select(channelColumns).from(channels).where(inArray(channels.userId, unique)),
      databaseUnavailable.during('findByUserIds')
    );

    return map(rows, (found) => found.map(toChannel));
  }

  findByHandle(handle: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    return this.findOneBy(channels.handle, handle.toLowerCase(), 'findByHandle');
  }

  async create(
    input: CreateChannelInput
  ): Promise<Result<Channel, DatabaseUnavailable | HandleTaken>> {
    const handle = input.handle.toLowerCase();
    const rows = await fromPromise(
      () =>
        this.db
          .insert(channels)
          .values({
            id: input.id ?? uuidv7(),
            userId: input.userId,
            handle,
            displayName: input.displayName,
            avatarUrl: input.avatarUrl ?? null,
            bannerUrl: input.bannerUrl ?? null,
            bio: input.bio ?? null,
            subscriberCount: input.subscriberCount ?? 0,
          })
          .returning({ id: channels.id }),
      this.conflict(handle, 'create')
    );

    if (!rows.ok) return rows;
    const [row] = rows.value;
    if (!row) return err(databaseUnavailable('create', 'insert returned no row'));

    const created = await this.findById(row.id);
    if (!created.ok) return created;
    return created.value
      ? ok(created.value)
      : err(databaseUnavailable('create', 'channel missing after insert'));
  }

  async update(
    id: string,
    input: UpdateChannelInput
  ): Promise<Result<Channel | null, DatabaseUnavailable | HandleTaken>> {
    const handle = input.handle?.toLowerCase();

    if (handle) {
      const conflicting = await fromPromise(
        () =>
          this.db
            .select({ id: channels.id })
            .from(channels)
            .where(and(eq(channels.handle, handle), ne(channels.id, id)))
            .limit(1),
        databaseUnavailable.during('update')
      );
      if (!conflicting.ok) return conflicting;
      if (conflicting.value[0]) return err(handleTaken(handle));
    }

    const values: Partial<typeof channels.$inferInsert> = { updatedAt: new Date() };
    if (handle !== undefined) values.handle = handle;
    if (input.displayName !== undefined) values.displayName = input.displayName;
    if (input.avatarUrl !== undefined) values.avatarUrl = input.avatarUrl;
    if (input.bannerUrl !== undefined) values.bannerUrl = input.bannerUrl;
    if (input.bio !== undefined) values.bio = input.bio;
    if (input.links !== undefined) values.links = input.links;

    const rows = await fromPromise(
      () =>
        this.db
          .update(channels)
          .set(values)
          .where(eq(channels.id, id))
          .returning({ id: channels.id }),
      this.conflict(handle ?? '', 'update')
    );

    if (!rows.ok) return rows;
    const [row] = rows.value;
    return row ? this.findById(row.id) : ok(null);
  }
}
