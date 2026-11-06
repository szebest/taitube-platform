import type { LiveChatOffsetRange, LiveChatRepositoryPort } from '@vp/core/repositories';
import type { LiveChatMessage, NewLiveChatMessage } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, map, ok, type Result } from '@vp/result';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';

interface StoredMessage extends NewLiveChatMessage {
  removedAt: Date | null;
}

export class InMemoryLiveChatRepository implements LiveChatRepositoryPort {
  private readonly rows = new Map<string, StoredMessage>();

  constructor(private readonly channels: Pick<InMemoryChannelRepository, 'findByUserIds'>) {}

  async append(message: NewLiveChatMessage): Promise<Result<LiveChatMessage, DatabaseUnavailable>> {
    this.rows.set(message.id, { ...message, removedAt: null });
    return map(await this.withAuthors([message]), ([appended]) => appended as LiveChatMessage);
  }

  async listAfter(
    liveStreamId: string,
    afterId: string | null,
    limit: number
  ): Promise<Result<LiveChatMessage[], DatabaseUnavailable>> {
    const shown = this.shown(liveStreamId).sort((a, b) => a.id.localeCompare(b.id));
    const page =
      afterId === null
        ? shown.slice(Math.max(0, shown.length - limit))
        : shown.filter((row) => row.id > afterId).slice(0, limit);
    return this.withAuthors(limit > 0 ? page : []);
  }

  async listByOffset(
    liveStreamId: string,
    { fromMs, toMs, limit }: LiveChatOffsetRange
  ): Promise<Result<LiveChatMessage[], DatabaseUnavailable>> {
    const page = this.shown(liveStreamId)
      .filter((row) => row.offsetMs >= fromMs && row.offsetMs < toMs)
      .sort((a, b) => a.offsetMs - b.offsetMs || a.id.localeCompare(b.id))
      .slice(0, limit);
    return this.withAuthors(page);
  }

  async listRemovedSince(
    liveStreamId: string,
    afterId: string,
    limit: number
  ): Promise<Result<string[], DatabaseUnavailable>> {
    const sentAt = this.rows.get(afterId)?.createdAt;
    if (sentAt === undefined) return ok([]);
    const removed = [...this.rows.values()]
      .filter((row) => row.liveStreamId === liveStreamId && row.removedAt !== null)
      .filter((row) => (row.removedAt?.getTime() ?? 0) >= sentAt.getTime())
      .slice(0, limit);
    return ok(removed.map((row) => row.id));
  }

  async remove(
    liveStreamId: string,
    messageId: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const row = this.rows.get(messageId);
    if (row?.liveStreamId !== liveStreamId || row.removedAt !== null) return ok(false);
    row.removedAt = at;
    return ok(true);
  }

  clear(): void {
    this.rows.clear();
  }

  private shown(liveStreamId: string): StoredMessage[] {
    return [...this.rows.values()].filter(
      (row) => row.liveStreamId === liveStreamId && row.removedAt === null
    );
  }

  private async withAuthors(
    rows: readonly NewLiveChatMessage[]
  ): Promise<Result<LiveChatMessage[], DatabaseUnavailable>> {
    const found = await this.channels.findByUserIds([...new Set(rows.map((row) => row.userId))]);
    if (isErr(found)) return found;
    const byUser = new Map(found.value.map((channel) => [channel.userId, channel]));

    return ok(
      rows.map(({ id, liveStreamId, userId, message, offsetMs, createdAt }) => {
        const channel = byUser.get(userId);
        return {
          id,
          liveStreamId,
          message,
          offsetMs,
          createdAt,
          author: {
            userId,
            handle: channel?.handle ?? null,
            displayName: channel?.displayName ?? null,
            avatarUrl: channel?.avatarUrl ?? null,
          },
        };
      })
    );
  }
}
