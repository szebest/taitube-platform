import { type DatabaseUnavailable, type WatchPartyNotFound, watchPartyNotFound } from '@vp/errors';
import { andThenAsync, err, ok, type Result } from '@vp/result';
import type { PartyCaller } from './party-caller';
import type { RoomContext, WatchPartyContextLoader } from './watch-party-context';

/** A member key for a caller who holds a seat; anyone else is a stranger to the room. */
export function seatedKeyOf(context: RoomContext): Result<string, WatchPartyNotFound> {
  return context.memberKey === null || context.seat === null
    ? err(watchPartyNotFound(context.room.id))
    : ok(context.memberKey);
}

/**
 * Loads the room as the caller sees it and hands the act their member key, or fails as a
 * stranger. A closed room refuses with `whenClosed`'s failure when the act changes something.
 */
export async function actingAsMember<T, E, C = never>(
  loader: WatchPartyContextLoader,
  roomId: string,
  caller: PartyCaller,
  act: (context: RoomContext, memberKey: string) => Promise<Result<T, E>>,
  whenClosed?: (roomId: string) => C
): Promise<Result<T, E | C | WatchPartyNotFound | DatabaseUnavailable>> {
  const loaded = await loader.load(roomId, caller);
  return andThenAsync(loaded, (context) =>
    andThenAsync(seatedKeyOf(context), (memberKey): Promise<Result<T, E | C>> | Result<T, C> =>
      whenClosed !== undefined && context.room.status === 'closed'
        ? err(whenClosed(roomId))
        : act(context, memberKey)
    )
  );
}
