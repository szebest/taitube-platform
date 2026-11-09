import type { banWatchPartyMember, transferWatchPartyOwnership } from '@vp/api-contracts';
import type { RoomWrite } from '@vp/core/repositories';
import { decideMemberAction, decideOwnerTransfer, requireRoomPermission } from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  type VersionConflict,
  type WatchPartyNotFound,
  type WatchPartyRoleEscalation,
  versionConflict,
  watchPartyNotFound,
} from '@vp/errors';
import { andThenAsync, err, map, ok, type Result } from '@vp/result';
import type { z } from 'zod';
import type { PartyCaller } from './party-caller';
import type { RoomContext } from './watch-party-context';
import type { WatchPartyDeps } from './watch-party-deps';
import { actingInRoom, memberKeyIn, resolveTarget } from './watch-party-member-targets';
import {
  announce,
  afterCommit,
  announceMemberRoles,
  announceLine,
  logChange,
  systemLineFor,
} from './watch-party-moderation-effects';
import { flushRoster } from './watch-party-roster-feed';

export type BanInput = z.output<typeof banWatchPartyMember.body>;
export type TransferInput = z.output<typeof transferWatchPartyOwnership.body>;

interface Transferred {
  readonly ownerKey: string;
  readonly rolesVersion: number;
}

export class WatchPartyMemberService {
  constructor(private readonly deps: WatchPartyDeps) {}

  kick(roomId: string, caller: PartyCaller, memberKey: string) {
    return actingInRoom(this.deps.context, roomId, caller, async (context, actorKey) => {
      const resolved = await resolveTarget(this.deps, context, memberKey, 'held');
      return andThenAsync(resolved, ({ subject }) =>
        andThenAsync(
          decideMemberAction({
            ability: context.ability,
            actorKey,
            action: 'kick',
            target: subject,
          }),
          async () => {
            const line = systemLineFor(this.deps, context.room, {
              event: 'kicked',
              actorKey,
              targetKey: memberKey,
              detail: null,
            });
            const left = await this.deps.repositories.watchPartyMembers.leave(
              roomId,
              memberKey,
              line,
              this.deps.now()
            );
            return afterCommit(left, async () => {
              await announceLine(this.deps, roomId, line);
              logChange(this.deps, {
                roomId,
                actorKey,
                action: 'member.kick',
                targetKey: memberKey,
              });
              await this.expel(roomId, [memberKey]);
            });
          }
        )
      );
    });
  }

  removeGuests(roomId: string, caller: PartyCaller) {
    return actingInRoom(this.deps.context, roomId, caller, (context, actorKey) =>
      andThenAsync(requireRoomPermission(context.ability, 'members.kick'), async () => {
        const line = systemLineFor(this.deps, context.room, {
          event: 'kicked',
          actorKey,
          targetKey: null,
          detail: 'guests',
        });
        const removed = await this.deps.repositories.watchPartyMembers.removeGuests(
          roomId,
          line,
          this.deps.now()
        );
        return afterCommit(removed, async (guestKeys) => {
          await announceLine(this.deps, roomId, line);
          logChange(this.deps, { roomId, actorKey, action: 'guests.remove' });
          await this.expel(roomId, guestKeys);
        });
      })
    );
  }

  ban(roomId: string, caller: PartyCaller, memberKey: string, input: BanInput) {
    return actingInRoom(this.deps.context, roomId, caller, async (context, actorKey) => {
      const resolved = await resolveTarget(this.deps, context, memberKey, 'any');
      return andThenAsync(resolved, ({ subject, seat }) =>
        andThenAsync(
          decideMemberAction({
            ability: context.ability,
            actorKey,
            action: 'ban',
            target: subject,
          }),
          async () => {
            const at = this.deps.now();
            const line = systemLineFor(this.deps, context.room, {
              event: 'banned',
              actorKey,
              targetKey: memberKey,
              detail: null,
            });
            const banned = await this.deps.repositories.watchPartyMembers.ban(
              {
                roomId,
                memberKey,
                ipHash: seat.ipHash,
                bannedBy: actorKey,
                reason: input?.reason ?? null,
                createdAt: at,
              },
              line
            );
            return afterCommit(banned, async () => {
              await announceLine(this.deps, roomId, line);
              logChange(this.deps, {
                roomId,
                actorKey,
                action: 'member.ban',
                targetKey: memberKey,
              });
              await this.expel(roomId, [memberKey]);
            });
          }
        )
      );
    });
  }

  unban(roomId: string, caller: PartyCaller, memberKey: string) {
    return actingInRoom(this.deps.context, roomId, caller, (context, actorKey) =>
      andThenAsync(requireRoomPermission(context.ability, 'members.ban'), () =>
        andThenAsync(memberKeyIn(roomId, memberKey), async () => {
          const lifted = await this.deps.repositories.watchPartyMembers.unban(roomId, memberKey);
          return map(lifted, () => {
            logChange(this.deps, {
              roomId,
              actorKey,
              action: 'member.unban',
              targetKey: memberKey,
            });
          });
        })
      )
    );
  }

  transferOwner(roomId: string, caller: PartyCaller, input: TransferInput) {
    return this.attemptTransfer(roomId, caller, input, false);
  }

  private attemptTransfer(
    roomId: string,
    caller: PartyCaller,
    input: TransferInput,
    retried: boolean
  ): Promise<
    Result<
      Transferred,
      WatchPartyNotFound | WatchPartyRoleEscalation | VersionConflict | DatabaseUnavailable
    >
  > {
    return actingInRoom(this.deps.context, roomId, caller, async (context, actorKey) => {
      const resolved = await resolveTarget(this.deps, context, input.memberKey, 'held');
      return andThenAsync(resolved, ({ subject }) =>
        andThenAsync(
          decideOwnerTransfer({ actorIsOwner: context.isOwner, actorKey, target: subject }),
          async () => {
            const written = await this.commitTransfer(context, actorKey, input.memberKey);
            if (!written.ok) return written;
            if (written.value.type === 'stale') {
              return retried
                ? err(versionConflict(roomId, context.room.rolesVersion))
                : this.attemptTransfer(roomId, caller, input, true);
            }
            if (written.value.type === 'missing') return err(watchPartyNotFound(roomId));
            return this.transferred(
              actorKey,
              input.memberKey,
              written.value.room.rolesVersion,
              roomId
            );
          }
        )
      );
    });
  }

  private async commitTransfer(
    context: RoomContext,
    actorKey: string,
    toKey: string
  ): Promise<Result<RoomWrite, DatabaseUnavailable>> {
    const { room, roles } = context;
    const cohost = roles.find(({ key }) => key === 'cohost');
    if (cohost === undefined) return ok({ type: 'missing' });
    const line = systemLineFor(this.deps, room, {
      event: 'owner_changed',
      actorKey,
      targetKey: toKey,
      detail: null,
    });
    const written = await this.deps.repositories.watchPartyRooms.transferOwner(room.id, {
      fromKey: actorKey,
      toKey,
      expectedRolesVersion: room.rolesVersion,
      cohostRoleId: cohost.id,
      line,
      at: this.deps.now(),
    });
    if (written.ok && written.value.type === 'applied') {
      await announceLine(this.deps, room.id, line);
    }
    return written;
  }

  private async transferred(
    previousKey: string,
    ownerKey: string,
    rolesVersion: number,
    roomId: string
  ): Promise<Result<Transferred, never>> {
    logChange(this.deps, {
      roomId,
      actorKey: previousKey,
      action: 'owner.transfer',
      targetKey: ownerKey,
    });
    await announce(this.deps, roomId, { type: 'owner', memberKey: ownerKey, rolesVersion });
    await announceMemberRoles(this.deps, roomId, previousKey, rolesVersion);
    return ok({ ownerKey, rolesVersion });
  }

  private async expel(roomId: string, memberKeys: readonly string[]): Promise<void> {
    for (const memberKey of memberKeys) {
      const left = await this.deps.presence.leave(roomId, memberKey);
      if (!left.ok) {
        this.deps.logger.warn({ err: left.error, roomId, memberKey }, 'presence not cleared');
      }
      await announce(this.deps, roomId, { type: 'kicked' }, memberKey);
    }
    await flushRoster(this.deps)(
      roomId,
      memberKeys.map((memberKey) => ({ type: 'removal', memberKey }))
    );
  }
}
