import type { Channel, CreateChannelInput, UpdateChannelInput } from '@vp/core/domain';
import { DatabaseError } from '@vp/core/ports';
import type { ChannelRepositoryPort } from '@vp/core/repositories';
import { channels } from '@vp/db';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { and, eq, ne } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { uuidv7 } from 'uuidv7';

export class PostgresChannelRepository implements ChannelRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase<Record<string, unknown>>) {}

  private mapRow(row: typeof channels.$inferSelect): Channel {
    return {
      id: row.id,
      userId: row.userId,
      handle: row.handle,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      bannerUrl: row.bannerUrl,
      bio: row.bio,
      subscriberCount: row.subscriberCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findById(id: string): Promise<Channel | null> {
    try {
      const [row] = await this.db.select().from(channels).where(eq(channels.id, id)).limit(1);
      return row ? this.mapRow(row) : null;
    } catch (err) {
      throw new DatabaseError(`Failed to find channel by ID: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async findByUserId(userId: string): Promise<Channel | null> {
    try {
      const [row] = await this.db
        .select()
        .from(channels)
        .where(eq(channels.userId, userId))
        .limit(1);
      return row ? this.mapRow(row) : null;
    } catch (err) {
      throw new DatabaseError(`Failed to find channel by user ID: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async findByHandle(handle: string): Promise<Channel | null> {
    try {
      const normalized = handle.toLowerCase();
      const [row] = await this.db
        .select()
        .from(channels)
        .where(eq(channels.handle, normalized))
        .limit(1);
      return row ? this.mapRow(row) : null;
    } catch (err) {
      throw new DatabaseError(`Failed to find channel by handle: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async create(input: CreateChannelInput): Promise<Channel> {
    const handle = input.handle.toLowerCase();
    try {
      const [row] = await this.db
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
        .returning();

      if (!row) {
        throw new DatabaseError('Failed to insert channel: no row returned');
      }
      return this.mapRow(row);
    } catch (err: unknown) {
      const pgErr = err as { code?: string; message?: string };
      if (pgErr.code === '23505') {
        throw new PermanentError(
          ErrorCodes.HANDLE_ALREADY_TAKEN,
          `Channel with handle "${handle}" or user already exists`
        );
      }
      if (err instanceof PermanentError) throw err;
      throw new DatabaseError(`Failed to create channel: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async update(id: string, input: UpdateChannelInput): Promise<Channel> {
    try {
      if (input.handle) {
        const normalized = input.handle.toLowerCase();
        const [conflict] = await this.db
          .select({ id: channels.id })
          .from(channels)
          .where(and(eq(channels.handle, normalized), ne(channels.id, id)))
          .limit(1);
        if (conflict) {
          throw new PermanentError(
            ErrorCodes.HANDLE_ALREADY_TAKEN,
            `Channel with handle "${normalized}" already exists`
          );
        }
      }

      const updateValues: Partial<typeof channels.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.handle !== undefined) updateValues.handle = input.handle.toLowerCase();
      if (input.displayName !== undefined) updateValues.displayName = input.displayName;
      if (input.avatarUrl !== undefined) updateValues.avatarUrl = input.avatarUrl;
      if (input.bannerUrl !== undefined) updateValues.bannerUrl = input.bannerUrl;
      if (input.bio !== undefined) updateValues.bio = input.bio;

      const [row] = await this.db
        .update(channels)
        .set(updateValues)
        .where(eq(channels.id, id))
        .returning();

      if (!row) {
        throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, `Channel ${id} not found`);
      }
      return this.mapRow(row);
    } catch (err: unknown) {
      const pgErr = err as { code?: string; message?: string };
      if (pgErr.code === '23505') {
        throw new PermanentError(ErrorCodes.HANDLE_ALREADY_TAKEN, 'Channel handle already taken');
      }
      if (err instanceof PermanentError) throw err;
      throw new DatabaseError(`Failed to update channel: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }
}
