import type { WatchPartyServerFrame } from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';
import { watchPartyChannel } from '@vp/events';
import { map, type Result } from '@vp/result';

/** A frame for every socket in the room, or for the one member `memberKey` names. */
export interface RoomEnvelope {
  readonly memberKey: string | null;
  readonly frame: WatchPartyServerFrame;
}

/**
 * Every room change goes out on the room's channel, from whichever pod made it; each pod writes it
 * to the sockets it holds.
 */
export class WatchPartyBroadcaster {
  constructor(private readonly cache: Pick<CacheClient, 'publish'>) {}

  async publish(roomId: string, envelope: RoomEnvelope): Promise<Result<void, CacheUnavailable>> {
    const sent = await this.cache.publish(watchPartyChannel(roomId), JSON.stringify(envelope));
    return map(sent, () => undefined);
  }

  toRoom(roomId: string, frame: WatchPartyServerFrame): Promise<Result<void, CacheUnavailable>> {
    return this.publish(roomId, { memberKey: null, frame });
  }

  toMember(
    roomId: string,
    memberKey: string,
    frame: WatchPartyServerFrame
  ): Promise<Result<void, CacheUnavailable>> {
    return this.publish(roomId, { memberKey, frame });
  }
}
