import type { Logger } from '@kit/logger';
import { isErr, ok, type Result } from '@kit/result';
import type { VoiceGatewayPort, VoiceParticipant } from '@vp/core/ports';
import { effectivePermissions, parseMemberKey } from '@vp/domain';
import type { DatabaseUnavailable, VoiceUnavailable } from '@vp/errors';
import type { PatternHub } from '../../pattern-hub';
import type { RoomEnvelope } from '../watch-party-broadcaster';
import type { WatchPartyDeps } from '../watch-party-deps';
import { announce } from '../watch-party-moderation-effects';
import { isServerMuted, voiceGrantsOf, voiceStateOf } from './voice-grants';
import { voiceRoomOf } from './voice-room';

const EXPIRY_SLACK_MS = 250;

export interface VoiceEnforcementDeps extends Pick<
  WatchPartyDeps,
  'repositories' | 'broadcaster' | 'logger' | 'now'
> {
  readonly gateway: VoiceGatewayPort;
  readonly hub: PatternHub<RoomEnvelope>;
  /** `WATCH_PARTY_VOICE_MAX_SPEAKERS`: a role change never raises the publishers past it. */
  readonly maxSpeakers: number;
}

export interface SyncOptions {
  /** Limit the pass to one member. */
  readonly only?: string;
  /** Let a pass give publish rights back; a join only ever takes rights away from what its token carried. */
  readonly raise?: boolean;
  /** Tell each member's own socket its voice state even when nothing changed: a join. */
  readonly announce?: boolean;
}

type SyncFailure = DatabaseUnavailable | VoiceUnavailable;

/**
 * The SFU's grants follow the room's roles: every role change the room hub carries recomputes what
 * each voice participant may do and replaces it in the SFU, and a mute that expires is lifted at
 * its expiry. A pod watches the rooms it has handed a token or a join to.
 */
export class VoiceEnforcement {
  private readonly leaves = new Map<string, () => void>();
  private readonly expiries = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly deps: VoiceEnforcementDeps) {}

  watch(roomId: string): void {
    if (this.leaves.has(roomId)) return;
    this.leaves.set(
      roomId,
      this.deps.hub.join(roomId, ({ memberKey, frame }) => {
        switch (frame.type) {
          case 'roles':
          case 'owner':
            void this.run(roomId, { raise: true });
            return;
          case 'member.roles':
            void this.run(roomId, { only: frame.memberKey, raise: true });
            return;
          case 'kicked':
            if (memberKey !== null) void this.drop(roomId, memberKey);
            return;
          case 'closed':
            void this.disband(roomId);
            return;
          default:
            return;
        }
      })
    );
  }

  unwatch(roomId: string): void {
    this.leaves.get(roomId)?.();
    this.leaves.delete(roomId);
    clearTimeout(this.expiries.get(roomId));
    this.expiries.delete(roomId);
  }

  close(): void {
    for (const roomId of [...this.leaves.keys()]) this.unwatch(roomId);
  }

  async sync(roomId: string, options: SyncOptions = {}): Promise<Result<void, SyncFailure>> {
    const { repositories, gateway, now } = this.deps;
    const [room, roles, assignments, seated, participants] = await Promise.all([
      repositories.watchPartyRooms.findById(roomId),
      repositories.watchPartyRoles.list(roomId, now()),
      repositories.watchPartyRoles.assignmentsIn(roomId),
      repositories.watchPartyMembers.listSeated(roomId),
      gateway.listParticipants(voiceRoomOf(roomId)),
    ]);
    if (isErr(room)) return room;
    if (isErr(roles)) return roles;
    if (isErr(assignments)) return assignments;
    if (isErr(seated)) return seated;
    if (isErr(participants)) return participants;

    const seats = new Map(seated.value.map((seat) => [seat.memberKey, seat]));
    const at = now();
    let nextExpiry: number | null = null;
    let publishers = participants.value.filter(({ grants }) => grants.canPublish).length;
    for (const participant of participants.value) {
      if (options.only !== undefined && participant.identity !== options.only) continue;
      const seat = seats.get(participant.identity);
      const kind = parseMemberKey(participant.identity)?.kind;
      if (seat === undefined || kind === undefined) {
        const removed = await gateway.removeParticipant(voiceRoomOf(roomId), participant.identity);
        if (isErr(removed)) return removed;
        continue;
      }
      const held = assignments.value.filter((row) => row.memberKey === participant.identity);
      const allowed = voiceGrantsOf(
        effectivePermissions({
          kind,
          isOwner: participant.identity === room.value?.ownerKey,
          roles: roles.value,
          assignments: held,
          now: at,
        })
      );
      const raises = options.raise === true && !participant.grants.canPublish;
      const mayRaise = raises && allowed.canPublish && publishers < this.deps.maxSpeakers;
      const grants = {
        canSubscribe:
          allowed.canSubscribe && (options.raise === true || participant.grants.canSubscribe),
        canPublish: mayRaise || (allowed.canPublish && participant.grants.canPublish),
      };
      if (mayRaise) publishers += 1;
      if (!grants.canPublish && participant.grants.canPublish) publishers -= 1;
      const changed = grantsDiffer(participant, grants);
      if (changed) {
        const updated = await gateway.updateParticipant(
          voiceRoomOf(roomId),
          participant.identity,
          grants
        );
        if (isErr(updated)) return updated;
      }
      if (changed || options.announce) {
        await announce(
          this.deps,
          roomId,
          { type: 'voice', state: voiceStateOf(grants, isServerMuted(roles.value, held, at)) },
          participant.identity
        );
      }
      for (const { expiresAt } of held) {
        if (expiresAt !== null && expiresAt > at) {
          nextExpiry = Math.min(nextExpiry ?? Infinity, expiresAt.getTime());
        }
      }
    }
    this.scheduleExpiry(roomId, nextExpiry, at);
    return ok();
  }

  private scheduleExpiry(roomId: string, expiresAt: number | null, at: Date): void {
    clearTimeout(this.expiries.get(roomId));
    this.expiries.delete(roomId);
    if (expiresAt === null || !this.leaves.has(roomId)) return;
    const timer = setTimeout(
      () => void this.run(roomId, { raise: true }),
      expiresAt - at.getTime() + EXPIRY_SLACK_MS
    );
    this.expiries.set(roomId, timer);
  }

  private async run(roomId: string, options: SyncOptions): Promise<void> {
    const synced = await this.sync(roomId, options);
    if (isErr(synced)) warn(this.deps.logger, roomId, synced.error);
  }

  private async drop(roomId: string, memberKey: string): Promise<void> {
    const removed = await this.deps.gateway.removeParticipant(voiceRoomOf(roomId), memberKey);
    if (isErr(removed)) warn(this.deps.logger, roomId, removed.error);
  }

  private async disband(roomId: string): Promise<void> {
    const listed = await this.deps.gateway.listParticipants(voiceRoomOf(roomId));
    if (isErr(listed)) warn(this.deps.logger, roomId, listed.error);
    else {
      for (const { identity } of listed.value) {
        const removed = await this.deps.gateway.removeParticipant(voiceRoomOf(roomId), identity);
        if (isErr(removed)) warn(this.deps.logger, roomId, removed.error);
      }
    }
    this.unwatch(roomId);
  }
}

function grantsDiffer(participant: VoiceParticipant, grants: VoiceParticipant['grants']): boolean {
  return (
    participant.grants.canSubscribe !== grants.canSubscribe ||
    participant.grants.canPublish !== grants.canPublish
  );
}

function warn(logger: Logger, roomId: string, cause: unknown): void {
  logger.warn({ err: cause, roomId }, 'voice grants not synced');
}
