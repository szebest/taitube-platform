import {
  WatchPartyPermissionSchema,
  type WatchPartyServerFrame,
  WatchPartyServerFrameSchema,
} from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import type { WatchPartyPermission } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import { watchPartyChannel } from '@vp/events';
import { map, type Result } from '@vp/result';
import { z } from 'zod';

/**
 * Who on the room channel a frame is for: every socket, the one member `memberKey` names, only the
 * holders of `audience`, and never the connection `except` names.
 */
export const RoomEnvelopeSchema = z.object({
  memberKey: z.string().nullable(),
  audience: WatchPartyPermissionSchema.nullable(),
  except: z.string().nullable(),
  /** When the publishing pod sent it, in epoch milliseconds: what the fan-out time is measured from. */
  sentAt: z.number().optional(),
  frame: WatchPartyServerFrameSchema,
});

export type RoomEnvelope = z.infer<typeof RoomEnvelopeSchema>;

const EVERYONE = { memberKey: null, audience: null, except: null } as const;

/**
 * Every room change goes out on the room's channel, from whichever pod made it; each pod writes it
 * to the sockets it holds.
 */
export class WatchPartyBroadcaster {
  constructor(
    private readonly cache: Pick<CacheClient, 'publish'>,
    private readonly now: () => number
  ) {}

  async publish(roomId: string, envelope: RoomEnvelope): Promise<Result<void, CacheUnavailable>> {
    const sent = await this.cache.publish(
      watchPartyChannel(roomId),
      JSON.stringify({ ...envelope, sentAt: this.now() })
    );
    return map(sent, () => undefined);
  }

  toRoom(roomId: string, frame: WatchPartyServerFrame): Promise<Result<void, CacheUnavailable>> {
    return this.publish(roomId, { ...EVERYONE, frame });
  }

  toMember(
    roomId: string,
    memberKey: string,
    frame: WatchPartyServerFrame
  ): Promise<Result<void, CacheUnavailable>> {
    return this.publish(roomId, { ...EVERYONE, memberKey, frame });
  }

  toHolders(
    roomId: string,
    audience: WatchPartyPermission,
    frame: WatchPartyServerFrame
  ): Promise<Result<void, CacheUnavailable>> {
    return this.publish(roomId, { ...EVERYONE, audience, frame });
  }

  /** Every other socket the member holds, on any pod, hears `superseded` and closes. */
  supersede(
    roomId: string,
    memberKey: string,
    connectionId: string
  ): Promise<Result<void, CacheUnavailable>> {
    return this.publish(roomId, {
      ...EVERYONE,
      memberKey,
      except: connectionId,
      frame: { type: 'superseded' },
    });
  }
}
