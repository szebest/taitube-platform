import type { Channel, CreateChannelInput, UpdateChannelInput } from '../domain/channel';

export interface ChannelRepositoryPort {
  findById(id: string): Promise<Channel | null>;
  findByUserId(userId: string): Promise<Channel | null>;
  findByHandle(handle: string): Promise<Channel | null>;
  create(input: CreateChannelInput): Promise<Channel>;
  update(id: string, input: UpdateChannelInput): Promise<Channel>;
}
