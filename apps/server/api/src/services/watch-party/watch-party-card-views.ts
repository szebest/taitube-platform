import { all, isErr, map, type Result } from '@kit/result';
import type { WatchPartyCardView } from '@vp/api-contracts';
import type { DiscoverableRoom } from '@vp/core/repositories';
import { type ChannelCard, effectiveCapacity, type RosterPreview, toChannelCard } from '@vp/domain';
import type { CacheUnavailable, DatabaseUnavailable } from '@vp/errors';
import type { WatchPartyDeps } from './watch-party-deps';
import { type PersonOf, resolvePeople } from './watch-party-names';
import { rosterPreviewOf } from './watch-party-preview';
import { toPartyVideoView } from './watch-party-views';

export type CardDeps = Pick<WatchPartyDeps, 'repositories' | 'presence' | 'config' | 'cdn' | 'now'>;

interface CardContext {
  readonly deps: CardDeps;
  readonly personOf: PersonOf;
  readonly channels: ReadonlyMap<string, ChannelCard>;
  readonly serverNow: number;
}

function toCard(
  { deps, personOf, channels, serverNow }: CardContext,
  { room, video }: DiscoverableRoom,
  roster: RosterPreview
): WatchPartyCardView {
  return {
    id: room.id,
    name: room.name,
    owner: personOf(room.ownerKey),
    channel: room.asChannelId === null ? null : (channels.get(room.asChannelId) ?? null),
    hasPassword: room.passwordHash !== null,
    allowGuests: room.allowGuests,
    capacity: room.capacity,
    effectiveCapacity: effectiveCapacity(room.capacity, deps.config.maxMembers),
    language: room.language,
    accent: room.accent,
    scheduledFor: room.scheduledFor?.toISOString() ?? null,
    phase: room.phase,
    status: room.status,
    currentVideo: video && {
      ...toPartyVideoView(video, deps.cdn),
      categoryId: video.categoryId ?? null,
    },
    queueLength: room.queueLength,
    presentCount: room.presentCount,
    roster: { ...roster, faces: [...roster.faces] },
    playback: room.playback,
    serverNow,
    createdAt: room.createdAt.toISOString(),
  };
}

/** One page of cards: the owners and the channels rooms are hosted as are read once for the page. */
export async function presentCards(
  deps: CardDeps,
  rows: readonly DiscoverableRoom[]
): Promise<Result<WatchPartyCardView[], DatabaseUnavailable | CacheUnavailable>> {
  const { repositories } = deps;
  const people = await resolvePeople(
    repositories.channels,
    rows.map(({ room }) => room.ownerKey)
  );
  if (isErr(people)) return people;
  const hosted = await repositories.channels.findByIds(
    rows.flatMap(({ room }) => room.asChannelId ?? [])
  );
  if (isErr(hosted)) return hosted;

  const context: CardContext = {
    deps,
    personOf: people.value,
    channels: new Map(hosted.value.map((channel) => [channel.id, toChannelCard(channel)])),
    serverNow: deps.now().getTime(),
  };
  return all(
    await Promise.all(
      rows.map(async (row) =>
        map(await rosterPreviewOf(deps, row.room), (roster) => toCard(context, row, roster))
      )
    )
  );
}
