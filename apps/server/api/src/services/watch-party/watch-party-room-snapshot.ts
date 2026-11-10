import type { WatchPartyServerFrame } from '@vp/api-contracts';
import { type RosterEntry, rosterFor } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { canInRoom } from '@vp/permissions';
import { isErr, map, ok, type Result } from '@vp/result';
import { readRoomChat } from './watch-party-chat';
import type { RoomContext } from './watch-party-context';
import type { WatchPartyDeps } from './watch-party-deps';
import { resolvePeople } from './watch-party-names';
import { presentQueue } from './watch-party-queue-views';
import { toRoleView } from './watch-party-role-views';
import { presentRoom } from './watch-party-room-views';
import { rosterEntryView } from './watch-party-roster-feed';
import { heldRoleIds, toRosterEntry } from './watch-party-views';

type Hello = Extract<WatchPartyServerFrame, { type: 'hello' }>;
type ChatLine = Extract<WatchPartyServerFrame, { type: 'chat.message' }>['message'];

type SnapshotDeps = Pick<WatchPartyDeps, 'repositories' | 'config' | 'cdn' | 'now'>;

/** Everyone seated, as the caller may see them: guests are one count unless they may remove them. */
export async function seatedRoster(
  deps: Pick<WatchPartyDeps, 'repositories' | 'now'>,
  context: RoomContext
): Promise<Result<{ entries: RosterEntry[]; guests: number }, DatabaseUnavailable>> {
  const { repositories, now } = deps;
  const { room, assignments } = context;
  const seated = await repositories.watchPartyMembers.listSeated(room.id);
  if (isErr(seated)) return seated;
  const people = await resolvePeople(
    repositories.channels,
    seated.value.map(({ memberKey }) => memberKey),
    new Map(seated.value.map((seat) => [seat.memberKey, seat]))
  );
  if (isErr(people)) return people;
  const at = now();
  const entries = seated.value.map((seat) =>
    toRosterEntry(
      seat,
      people.value(seat.memberKey),
      heldRoleIds(assignments, seat.memberKey, at),
      room
    )
  );
  const shown = rosterFor(entries, canInRoom(context.ability, 'members.kick'));
  return ok({ entries: [...shown.entries], guests: shown.guests });
}

export interface RoomSnapshot {
  readonly hello: Hello;
  /** Lines a resuming client may still show that were removed while it was away. */
  readonly removed: readonly string[];
  readonly lines: readonly ChatLine[];
}

/** The full state a socket starts from, so a reconnect needs no replay but the chat. */
export async function roomSnapshot(
  deps: SnapshotDeps,
  context: RoomContext,
  memberKey: string,
  after: string | null
): Promise<Result<RoomSnapshot, DatabaseUnavailable>> {
  const { room, roles, assignments, kind } = context;
  const [view, queue, roster, chat] = await Promise.all([
    presentRoom(deps, room),
    deps.repositories.watchPartyQueue.list(room.id),
    seatedRoster(deps, context),
    readRoomChat(deps, room.id, after),
  ]);
  if (isErr(view)) return view;
  if (isErr(queue)) return queue;
  if (isErr(roster)) return roster;
  if (isErr(chat)) return chat;
  const queueView = await presentQueue(deps, queue.value);
  const at = deps.now();
  return map(queueView, (presented) => ({
    hello: {
      type: 'hello',
      room: view.value,
      roles: roles.map(toRoleView),
      rolesVersion: room.rolesVersion,
      you: {
        memberKey,
        kind: kind ?? 'guest',
        roleIds: heldRoleIds(assignments, memberKey, at),
      },
      playback: room.playback,
      version: room.playbackVersion,
      serverNow: at.getTime(),
      queue: presented,
      roster: { entries: roster.value.entries.map(rosterEntryView), guests: roster.value.guests },
      chat: {
        resume: chat.value.resume,
        mode: { enabled: room.chatEnabled, slowModeSeconds: room.slowModeSeconds },
        pinned: chat.value.pinned,
      },
    },
    removed: chat.value.removed,
    lines: chat.value.lines,
  }));
}
