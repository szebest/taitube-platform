import type { WatchPartyView } from '@vp/api-contracts';
import type { WatchPartyRoom } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { all, andThenAsync, map, ok, type Result } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';
import { type PersonOf, resolvePeople } from './watch-party-names';
import { type PartyVideoView, toPartyVideoView, toWatchPartyView } from './watch-party-views';

type RoomViewDeps = Pick<WatchPartyDeps, 'repositories' | 'config' | 'cdn'>;

async function currentVideoOf(
  { repositories, cdn }: RoomViewDeps,
  room: WatchPartyRoom
): Promise<Result<PartyVideoView | null, DatabaseUnavailable>> {
  if (room.currentVideoId === null) return ok(null);
  const video = await repositories.videos.findById(room.currentVideoId);
  return map(video, (found) => (found === null ? null : toPartyVideoView(found, cdn)));
}

async function viewOf(
  deps: RoomViewDeps,
  personOf: PersonOf,
  room: WatchPartyRoom
): Promise<Result<WatchPartyView, DatabaseUnavailable>> {
  const currentVideo = await currentVideoOf(deps, room);
  return map(currentVideo, (video) =>
    toWatchPartyView({
      room,
      owner: personOf(room.ownerKey),
      currentVideo: video,
      ceiling: deps.config.maxMembers,
    })
  );
}

export async function presentRoom(
  deps: RoomViewDeps,
  room: WatchPartyRoom
): Promise<Result<WatchPartyView, DatabaseUnavailable>> {
  const people = await resolvePeople(deps.repositories.channels, [room.ownerKey]);
  return andThenAsync(people, (personOf) => viewOf(deps, personOf, room));
}

export async function presentRooms(
  deps: RoomViewDeps,
  rooms: readonly WatchPartyRoom[]
): Promise<Result<WatchPartyView[], DatabaseUnavailable>> {
  const people = await resolvePeople(
    deps.repositories.channels,
    rooms.map(({ ownerKey }) => ownerKey)
  );
  return andThenAsync(people, async (personOf) =>
    all(await Promise.all(rooms.map((room) => viewOf(deps, personOf, room))))
  );
}
