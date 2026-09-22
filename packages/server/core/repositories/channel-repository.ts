import type { Channel, CreateChannelInput, UpdateChannelInput } from '@vp/domain';
import type { DatabaseUnavailable, HandleTaken } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * A handle collision is a constraint the store reports; whether a missing channel is an error is a
 * domain decision, so every read answers `ok(null)` for an absent row.
 */
export interface ChannelRepositoryPort {
  findById(id: string): Promise<Result<Channel | null, DatabaseUnavailable>>;
  findByUserId(userId: string): Promise<Result<Channel | null, DatabaseUnavailable>>;
  findByHandle(handle: string): Promise<Result<Channel | null, DatabaseUnavailable>>;
  create(input: CreateChannelInput): Promise<Result<Channel, DatabaseUnavailable | HandleTaken>>;
  update(
    id: string,
    input: UpdateChannelInput
  ): Promise<Result<Channel | null, DatabaseUnavailable | HandleTaken>>;
}
