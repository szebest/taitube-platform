import { isErr, ok } from '@kit/result';
import { parseMemberKey, type WatchPartyRoom, watchPartySearchText } from '@vp/domain';
import type { WatchPartyDeps } from './watch-party-deps';

type SearchTextDeps = Pick<WatchPartyDeps, 'repositories' | 'logger'>;

/**
 * Rewrites what discovery's text search reads: the room name, its owner's handle and display name and
 * the current video's title. Called after every change to one of them, and never fails the change
 * that caused it: a stale text only costs the room a search hit until the next change.
 */
export async function refreshSearchText(
  { repositories, logger }: SearchTextDeps,
  room: Pick<WatchPartyRoom, 'id' | 'name' | 'ownerKey' | 'currentVideoId'>
): Promise<void> {
  const owner = parseMemberKey(room.ownerKey);
  const channel =
    owner?.kind === 'user' ? await repositories.channels.findPrimaryByUserId(owner.id) : ok(null);
  if (isErr(channel)) {
    logger.warn({ err: channel.error, roomId: room.id }, 'search text not refreshed');
    return;
  }
  const video =
    room.currentVideoId === null
      ? ok(null)
      : await repositories.videos.findById(room.currentVideoId);
  if (isErr(video)) {
    logger.warn({ err: video.error, roomId: room.id }, 'search text not refreshed');
    return;
  }

  const text = watchPartySearchText({
    name: room.name,
    ownerHandle: channel.value?.handle ?? null,
    ownerName: channel.value?.displayName ?? null,
    videoTitle: video.value?.title ?? null,
  });
  const written = await repositories.watchPartyRooms.setSearchText(room.id, text);
  if (isErr(written))
    logger.warn({ err: written.error, roomId: room.id }, 'search text not written');
}
