import { type DatabaseUnavailable, databaseUnavailable } from '@kit/errors';
import { type Result, err, fromPromise, map, ok } from '@kit/result';
import type { ChannelRepositoryPort } from '@vp/core/repositories';
import { channels, videos } from '@vp/db';
import type {
  Channel,
  ChannelStats,
  CreateChannelInput,
  NewChannelAuditEntry,
  UpdateChannelInput,
} from '@vp/domain';
import {
  type ChannelLimitReached,
  type HandleTaken,
  channelLimitReached,
  handleTaken,
} from '@vp/errors';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { isUniqueViolation } from '../pg-errors';
import { appendChannelAudit } from './channel-audit-writes';
import { insertOwnedChannel, newChannelRow, promoteChannel } from './channel-ownership';
import { channelPatch, claimHandle } from './channel-writes';
import { publicFeedScope } from './public-feed-query';
import type { PostgresDatabase } from './types';

function mapRow(row: typeof channels.$inferSelect): Channel {
  return {
    id: row.id,
    userId: row.userId,
    isPrimary: row.isPrimary,
    handle: row.handle,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    bannerUrl: row.bannerUrl,
    brandColor: row.brandColor,
    bio: row.bio,
    links: row.links,
    avatarVersion: row.avatarVersion,
    bannerVersion: row.bannerVersion,
    bannerCrops: row.bannerCrops,
    country: row.country,
    contactEmail: row.contactEmail,
    bannerLink: row.bannerLink,
    handleChangedAt: row.handleChangedAt,
    subscriberCount: row.subscriberCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PostgresChannelRepository implements ChannelRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  /** A held handle and a second primary channel for one user both answer a taken handle. */
  private conflict(handle: string, operation: string) {
    return (cause: unknown): DatabaseUnavailable | HandleTaken =>
      isUniqueViolation(cause) ? handleTaken(handle) : databaseUnavailable(operation, cause);
  }

  private async findOneBy(
    column: (typeof channels)['id' | 'handle'],
    value: string,
    operation: string
  ): Promise<Result<Channel | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(channels).where(eq(column, value)).limit(1),
      databaseUnavailable.during(operation)
    );

    return map(rows, ([row]) => (row ? mapRow(row) : null));
  }

  findById(id: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    return this.findOneBy(channels.id, id, 'findById');
  }

  async listByUserId(userId: string): Promise<Result<Channel[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(channels)
          .where(eq(channels.userId, userId))
          .orderBy(desc(channels.isPrimary), asc(channels.createdAt), asc(channels.id)),
      databaseUnavailable.during('listByUserId')
    );

    return map(rows, (found) => found.map(mapRow));
  }

  async findPrimaryByUserId(userId: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    const found = await this.findPrimaryByUserIds([userId]);
    return map(found, ([channel]) => channel ?? null);
  }

  async findPrimaryByUserIds(
    userIds: readonly string[]
  ): Promise<Result<Channel[], DatabaseUnavailable>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) {
      return ok([]);
    }

    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(channels)
          .where(and(inArray(channels.userId, unique), eq(channels.isPrimary, true))),
      databaseUnavailable.during('findPrimaryByUserIds')
    );

    return map(rows, (found) => found.map(mapRow));
  }

  async findByIds(ids: readonly string[]): Promise<Result<Channel[], DatabaseUnavailable>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return ok([]);
    }

    const rows = await fromPromise(
      () => this.db.select().from(channels).where(inArray(channels.id, unique)),
      databaseUnavailable.during('findByIds')
    );

    return map(rows, (found) => found.map(mapRow));
  }

  findByHandle(handle: string): Promise<Result<Channel | null, DatabaseUnavailable>> {
    return this.findOneBy(channels.handle, handle.toLowerCase(), 'findByHandle');
  }

  async create(
    input: CreateChannelInput
  ): Promise<Result<Channel, DatabaseUnavailable | HandleTaken>> {
    const values = newChannelRow(input, true);
    const rows = await fromPromise(
      () => this.db.insert(channels).values(values).returning(),
      this.conflict(values.handle, 'create')
    );

    if (!rows.ok) return rows;
    const [row] = rows.value;
    return row ? ok(mapRow(row)) : err(databaseUnavailable('create', 'insert returned no row'));
  }

  async createOwned(
    input: CreateChannelInput,
    limit: number,
    audit?: NewChannelAuditEntry
  ): Promise<Result<Channel, DatabaseUnavailable | HandleTaken | ChannelLimitReached>> {
    const handle = input.handle.toLowerCase();
    const written = await fromPromise(
      () => insertOwnedChannel(this.db, input, limit, audit),
      this.conflict(handle, 'createOwned')
    );

    if (!written.ok) return written;
    return written.value === 'limit' ? err(channelLimitReached(limit)) : ok(mapRow(written.value));
  }

  async promote(
    userId: string,
    channelId: string,
    audit?: NewChannelAuditEntry
  ): Promise<Result<Channel | null, DatabaseUnavailable>> {
    const promoted = await fromPromise(
      () => promoteChannel(this.db, userId, channelId, audit),
      databaseUnavailable.during('promote')
    );

    return map(promoted, (row) => (row ? mapRow(row) : null));
  }

  async update(
    id: string,
    input: UpdateChannelInput,
    audit?: NewChannelAuditEntry
  ): Promise<Result<Channel | null, DatabaseUnavailable | HandleTaken>> {
    const handle = input.handle?.toLowerCase();

    const written = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const values = channelPatch(input);
          if (handle !== undefined && input.handleChangedAt !== undefined) {
            const claimed = await claimHandle(tx, id, handle, input.handleChangedAt);
            if (claimed === 'taken') return claimed;
            Object.assign(values, claimed);
          }
          const [row] = await tx
            .update(channels)
            .set(values)
            .where(eq(channels.id, id))
            .returning();
          if (row && audit) await appendChannelAudit(tx, audit);
          return row;
        }),
      this.conflict(handle ?? '', 'update')
    );

    if (!written.ok) return written;
    if (written.value === 'taken') return err(handleTaken(handle ?? ''));
    return ok(written.value ? mapRow(written.value) : null);
  }

  async statsOf(channelId: string): Promise<Result<ChannelStats, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({
            videoCount: sql<number>`count(*)`.mapWith(Number),
            totalViews: sql<number>`coalesce(sum(${videos.viewsCount}), 0)`.mapWith(Number),
          })
          .from(videos)
          .where(publicFeedScope({ channelId })),
      databaseUnavailable.during('statsOf')
    );

    return map(rows, ([row]) => row ?? { videoCount: 0, totalViews: 0 });
  }
}
