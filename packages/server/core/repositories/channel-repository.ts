import type { Channel, ChannelStats, CreateChannelInput, UpdateChannelInput } from '@vp/domain';
import type { DatabaseUnavailable, HandleTaken } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * A handle collision is a constraint the store reports; whether a missing channel is an error is a
 * domain decision, so every read answers `ok(null)` for an absent row.
 */
export interface ChannelRepositoryPort {
  findById(id: string): Promise<Result<Channel | null, DatabaseUnavailable>>;
  findByUserId(userId: string): Promise<Result<Channel | null, DatabaseUnavailable>>;
  /** One read for a page of owners; a user with no channel is simply absent from the answer. */
  findByUserIds(userIds: readonly string[]): Promise<Result<Channel[], DatabaseUnavailable>>;
  findByHandle(handle: string): Promise<Result<Channel | null, DatabaseUnavailable>>;
  /** What the public feed shows of the owner's videos: the numbers on a channel page. */
  statsOf(userId: string): Promise<Result<ChannelStats, DatabaseUnavailable>>;
  create(input: CreateChannelInput): Promise<Result<Channel, DatabaseUnavailable | HandleTaken>>;
  update(
    id: string,
    input: UpdateChannelInput
  ): Promise<Result<Channel | null, DatabaseUnavailable | HandleTaken>>;
}
