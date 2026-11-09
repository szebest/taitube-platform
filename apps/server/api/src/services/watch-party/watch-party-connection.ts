import type { WatchPartyServerFrame } from '@vp/api-contracts';
import { parseMemberKey, type RosterEntry } from '@vp/domain';
import { MS_PER_SECOND } from '@vp/domain/time';
import { canInRoom } from '@vp/permissions';
import { isErr, ok, type Result } from '@vp/result';
import type { PartyCaller } from './party-caller';
import type { RoomEnvelope } from './watch-party-broadcaster';
import type { RoomContext } from './watch-party-context';
import { answerFrame, type FrameFailure, type FrameSender, readFrame } from './watch-party-frames';
import { resolvePeople } from './watch-party-names';
import { roomSnapshot } from './watch-party-room-snapshot';
import { rosterPatchFor } from './watch-party-roster-feed';
import type { ConnectFailure, RoomSession, RoomSocketDeps } from './watch-party-socket-service';
import { heldRoleIds, toRosterEntry } from './watch-party-views';

export interface ConnectionIo {
  send(frame: WatchPartyServerFrame): void;
  /** Closes the socket after a frame that ends it: kicked, superseded or closed. */
  end(): void;
}

interface OpenInput {
  readonly session: RoomSession;
  readonly id: string;
  readonly after: string | null;
  readonly io: ConnectionIo;
  readonly leaveHub: () => void;
}

type FrameType = WatchPartyServerFrame['type'];

const ENDING: ReadonlySet<FrameType> = new Set<FrameType>(['kicked', 'superseded', 'closed']);
const ROLE_FRAMES: ReadonlySet<FrameType> = new Set<FrameType>(['roles', 'member.roles', 'owner']);

export interface FrameReply {
  readonly ref?: string;
  readonly result: Result<WatchPartyServerFrame, FrameFailure>;
}

/** One member's socket on this pod: what it hears, what it may send, and its roster entry. */
export class RoomConnection {
  private superseded = false;
  private closed = false;
  private readonly keepalive: ReturnType<typeof setInterval>;

  private constructor(
    private readonly deps: RoomSocketDeps,
    private readonly id: string,
    private readonly roomId: string,
    private caller: PartyCaller,
    private memberKey: string,
    private context: RoomContext,
    private entry: RosterEntry,
    private readonly io: ConnectionIo,
    private readonly leaveHub: () => void
  ) {
    const { presence, config, now } = deps;
    deps.metrics.watchPartySockets.inc();
    this.keepalive = setInterval(
      () =>
        void this.keep(
          presence.touch(roomId, [this.memberKey], now().getTime()),
          'presence not kept'
        ),
      config.presence.keepaliveMs
    );
  }

  /** Sends the snapshot and the chat backlog, then claims the member's one socket in the room. */
  static async open(
    deps: RoomSocketDeps,
    { session, id, after, io, leaveHub }: OpenInput
  ): Promise<Result<{ connection: RoomConnection; sentLines: string[] }, ConnectFailure>> {
    const { roomId, caller, memberKey } = session;
    const loaded = await deps.context.load(roomId, caller);
    if (isErr(loaded)) return loaded;
    const context = loaded.value;
    const snapshot = await roomSnapshot(deps, context, memberKey, after);
    if (isErr(snapshot)) return snapshot;
    const people = await resolvePeople(
      deps.repositories.channels,
      [memberKey],
      context.seat === null ? undefined : new Map([[memberKey, context.seat]])
    );
    if (isErr(people)) return people;

    const { hello, removed, lines } = snapshot.value;
    io.send(hello);
    for (const removedId of removed) io.send({ type: 'chat.removed', id: removedId });
    for (const message of lines) io.send({ type: 'chat.message', message });

    const entry = toRosterEntry(
      context.seat ?? { memberKey, kind: session.kind },
      people.value(memberKey),
      heldRoleIds(context.assignments, memberKey, deps.now()),
      context.room
    );
    const connection = new RoomConnection(
      deps,
      id,
      roomId,
      caller,
      memberKey,
      context,
      entry,
      io,
      leaveHub
    );
    if (context.isOwner) deps.ownerGrace.cancel(roomId);
    else if (session.kind !== 'guest') deps.ownerGrace.recheck(roomId);
    deps.roster.add(roomId, { type: 'upsert', entry });
    const claimed = await deps.broadcaster.supersede(roomId, memberKey, id);
    if (isErr(claimed)) deps.logger.warn({ err: claimed.error, roomId }, 'older socket kept');
    return ok({ connection, sentLines: lines.map((line) => line.id) });
  }

  deliver({ memberKey, audience, except, sentAt, frame }: RoomEnvelope): void {
    if (except === this.id) return;
    if (memberKey !== null && memberKey !== this.memberKey) return;
    if (audience !== null && !canInRoom(this.context.ability, audience)) return;
    if (sentAt !== undefined) {
      const lateMs = Math.max(0, this.deps.now().getTime() - sentAt);
      this.deps.metrics.watchPartyFanoutSeconds.observe(lateMs / MS_PER_SECOND);
    }

    if (frame.type === 'superseded') this.superseded = true;
    if (frame.type === 'roster.patch') {
      this.io.send(rosterPatchFor(frame, canInRoom(this.context.ability, 'members.kick')));
      return;
    }
    if (frame.type === 'you') this.becomes(frame.memberKey);
    this.io.send(frame);
    if (ENDING.has(frame.type)) this.io.end();
    if (ROLE_FRAMES.has(frame.type) || frame.type === 'you') void this.refresh();
  }

  async receive(raw: string): Promise<FrameReply> {
    const frame = readFrame(raw, this.deps.config.frameMaxBytes);
    if (isErr(frame)) return { result: frame };
    const { deps, roomId, caller, memberKey, context, io } = this;
    const sender: FrameSender = {
      roomId,
      caller,
      memberKey,
      guest: this.entry.kind === 'guest',
      ability: context.ability,
      direct: io.send,
      patch: (change) => {
        this.entry = { ...this.entry, ...change };
        deps.roster.add(roomId, { type: 'upsert', entry: this.entry });
      },
    };
    return { ref: frame.value.ref, result: await answerFrame(deps, sender, frame.value) };
  }

  /** The seat stays the member's on a superseded socket's close: the newer one holds it. */
  leave(): void {
    if (this.closed) return;
    this.closed = true;
    this.deps.metrics.watchPartySockets.dec();
    clearInterval(this.keepalive);
    this.leaveHub();
    if (this.superseded) return;
    const { deps, roomId, memberKey } = this;
    deps.buffering.stop(roomId, memberKey);
    if (this.context.room.ownerKey === memberKey) deps.ownerGrace.begin(roomId);
    void this.keep(deps.presence.leave(roomId, memberKey), 'presence not cleared');
  }

  /** A seat upgraded in place: the same socket carries on as the account. */
  private becomes(memberKey: string): void {
    const account = parseMemberKey(memberKey);
    if (account?.kind !== 'user') return;
    const { deps, roomId } = this;
    const previous = this.memberKey;
    this.memberKey = memberKey;
    this.caller = { user: { id: account.id, role: 'USER' }, party: null, ip: this.caller.ip };
    this.entry = { ...this.entry, memberKey, kind: 'user' };
    deps.roster.add(roomId, { type: 'removal', memberKey: previous });
    deps.roster.add(roomId, { type: 'upsert', entry: this.entry });
    void this.keep(deps.presence.leave(roomId, previous), 'presence not moved');
    const nowMs = deps.now().getTime();
    void this.keep(
      deps.presence.admit(roomId, memberKey, { limit: null, nowMs, staleBeforeMs: 0 }),
      'presence not moved'
    );
  }

  /** Presence is best effort: a missed write ages out with the keepalive. */
  private async keep(write: Promise<Result<unknown, unknown>>, step: string): Promise<void> {
    const done = await write;
    if (!done.ok) {
      this.deps.logger.warn({ err: done.error, roomId: this.roomId, step }, 'presence not written');
    }
  }

  /** Every role frame re-reads the room, so what this socket may hear and send follows within one broadcast. */
  private async refresh(): Promise<void> {
    const loaded = await this.deps.context.load(this.roomId, this.caller);
    if (isErr(loaded)) {
      this.deps.logger.warn({ err: loaded.error, roomId: this.roomId }, 'socket roles kept');
      return;
    }
    this.context = loaded.value;
    const roleIds = heldRoleIds(loaded.value.assignments, this.memberKey, this.deps.now());
    if (roleIds.join() !== this.entry.roleIds.join()) {
      this.entry = { ...this.entry, roleIds };
      this.deps.roster.add(this.roomId, { type: 'upsert', entry: this.entry });
    }
  }
}
