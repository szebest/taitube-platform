import type { inviteToWatchParty } from '@vp/api-contracts';
import { memberKeyOf, type WatchPartyInvite } from '@vp/domain';
import { requireRoomPermission } from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  type WatchPartyInviteInvalid,
  watchPartyClosed,
  watchPartyInviteInvalid,
  watchPartyNotFound,
} from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { andThenAsync, err, isErr, map, ok, type Result } from '@vp/result';
import type { z } from 'zod';
import type { PartyCaller } from './party-caller';
import { consumeBudget } from './watch-party-budgets';
import type { WatchPartyDeps } from './watch-party-deps';
import { listInviteCandidates } from './watch-party-invite-candidates';
import {
  createInviteLink,
  type InviteLinkInput,
  listInviteLinks,
  revokeInviteLink,
} from './watch-party-invite-links';
import { sendInvites } from './watch-party-invite-sending';
import { actingAsMember } from './watch-party-seated-actions';

export type InviteInput = z.output<typeof inviteToWatchParty.body>;

/** An invite is sent by an account on both ends: a session, never a party credential alone. */
export type AccountCaller = PartyCaller & { readonly user: UserContext };

/** A decline reads as pending to the inviter, so declining carries no social cost. */
function toInviteView(invite: WatchPartyInvite) {
  return {
    id: invite.id,
    inviteeId: invite.inviteeId,
    inviterId: invite.inviterId,
    status: invite.status === 'joined' ? ('joined' as const) : ('pending' as const),
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  };
}

export class WatchPartyInviteService {
  constructor(private readonly deps: WatchPartyDeps) {}

  invite(roomId: string, caller: AccountCaller, { userIds }: InviteInput) {
    return actingAsMember(
      this.deps.context,
      roomId,
      caller,
      (context, inviterKey) =>
        andThenAsync(requireRoomPermission(context.ability, 'members.invite'), async () => {
          const invitees = [...new Set(userIds)];
          const budget = await this.spendBudget(caller.user.id, invitees.length);
          return andThenAsync(budget, async () => {
            const outcome = await sendInvites(this.deps, context.room, caller.user.id, invitees);
            return map(outcome, (done) => {
              this.deps.logger.info(
                {
                  roomId,
                  actorKey: inviterKey,
                  action: 'invite.send',
                  sent: done.sent.length,
                  folded: done.folded.length,
                  refused: done.refused.length,
                },
                'watch party change'
              );
              return done;
            });
          });
        }),
      watchPartyClosed
    );
  }

  list(roomId: string, caller: AccountCaller) {
    return actingAsMember(this.deps.context, roomId, caller, (context) =>
      andThenAsync(requireRoomPermission(context.ability, 'members.invite'), async () => {
        const invites = await this.deps.repositories.watchPartyInvites.listForRoom(roomId);
        return map(invites, (found) => ({ items: found.map(toInviteView) }));
      })
    );
  }

  revoke(roomId: string, caller: AccountCaller, inviteId: string) {
    return actingAsMember(this.deps.context, roomId, caller, (context, memberKey) =>
      andThenAsync(requireRoomPermission(context.ability, 'members.invite'), async () => {
        const revoked = await this.deps.repositories.watchPartyInvites.revoke(roomId, inviteId);
        return andThenAsync(revoked, (changed) => {
          if (!changed) return err(watchPartyNotFound(roomId));
          this.deps.logger.info(
            { roomId, actorKey: memberKey, action: 'invite.revoke' },
            'watch party change'
          );
          return ok(undefined);
        });
      })
    );
  }

  async decline(
    user: UserContext,
    inviteId: string
  ): Promise<Result<void, WatchPartyInviteInvalid | DatabaseUnavailable>> {
    const declined = await this.deps.repositories.watchPartyInvites.decline(user.id, inviteId);
    return andThenAsync(declined, (invite) => {
      if (invite === null) return err(watchPartyInviteInvalid(inviteId));
      this.deps.logger.info(
        {
          roomId: invite.roomId,
          actorKey: memberKeyOf({ kind: 'user', userId: user.id }),
          action: 'invite.decline',
        },
        'watch party change'
      );
      return ok(undefined);
    });
  }

  createLink(roomId: string, caller: PartyCaller, input: InviteLinkInput) {
    return createInviteLink(this.deps, roomId, caller, input);
  }

  listLinks(roomId: string, caller: AccountCaller) {
    return listInviteLinks(this.deps, roomId, caller);
  }

  revokeLink(roomId: string, caller: AccountCaller, linkId: string) {
    return revokeInviteLink(this.deps, roomId, caller, linkId);
  }

  candidates(roomId: string, caller: AccountCaller, q: string | undefined) {
    return listInviteCandidates(this.deps, roomId, caller, caller.user.id, q);
  }

  /** Each invitee counts, wherever their settings send the invite, so a refusal cannot be probed for free. */
  private async spendBudget(inviterId: string, invitees: number) {
    const rule = this.deps.config.budgets.invite;
    for (let n = 0; n < invitees; n += 1) {
      const spent = await consumeBudget(this.deps.gate, 'invite', inviterId, rule);
      if (isErr(spent)) return spent;
    }
    return ok(undefined);
  }
}
