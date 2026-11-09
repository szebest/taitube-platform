import {
  INVITE_LINK_TTL_MS,
  type WatchPartyInviteLink,
  type WatchPartyInviteLinkTtl,
} from '@vp/domain';
import { requireRoomPermission } from '@vp/domain-rules';
import { watchPartyClosed, watchPartyNotFound } from '@vp/errors';
import { andThenAsync, err, map, ok } from '@vp/result';
import type { PartyCaller } from './party-caller';
import type { WatchPartyDeps } from './watch-party-deps';
import { logChange } from './watch-party-moderation-effects';
import { actingAsMember } from './watch-party-seated-actions';

export interface InviteLinkInput {
  readonly ttl: WatchPartyInviteLinkTtl;
  readonly maxUses?: number | undefined;
}

type LinkDeps = Pick<
  WatchPartyDeps,
  'repositories' | 'context' | 'secrets' | 'webUrl' | 'logger' | 'now'
>;

function toInviteLinkView(link: WatchPartyInviteLink) {
  return {
    id: link.id,
    createdBy: link.createdBy,
    expiresAt: link.expiresAt.toISOString(),
    maxUses: link.maxUses,
    uses: link.uses,
    revoked: link.revokedAt !== null,
    createdAt: link.createdAt.toISOString(),
  };
}

/** A link's token leaves here once, in this answer; only its hash is stored. */
export function createInviteLink(
  deps: LinkDeps,
  roomId: string,
  caller: PartyCaller,
  { ttl, maxUses }: InviteLinkInput
) {
  return actingAsMember(
    deps.context,
    roomId,
    caller,
    (context, memberKey) =>
      andThenAsync(requireRoomPermission(context.ability, 'members.invite'), async () => {
        const now = deps.now();
        const token = deps.secrets.newToken();
        const created = await deps.repositories.watchPartyInviteLinks.create({
          id: deps.secrets.newId(),
          roomId,
          createdBy: memberKey,
          tokenHash: deps.secrets.hashToken(token),
          expiresAt: new Date(now.getTime() + INVITE_LINK_TTL_MS[ttl]),
          maxUses: maxUses ?? null,
          uses: 0,
          revokedAt: null,
          createdAt: now,
        });
        return map(created, (link) => {
          logChange(deps, { roomId, actorKey: memberKey, action: 'invite-link.create' });
          return {
            id: link.id,
            token,
            url: `${deps.webUrl}/parties/${roomId}?invite=${token}`,
            expiresAt: link.expiresAt.toISOString(),
          };
        });
      }),
    watchPartyClosed
  );
}

export function listInviteLinks(deps: LinkDeps, roomId: string, caller: PartyCaller) {
  return actingAsMember(deps.context, roomId, caller, (context) =>
    andThenAsync(requireRoomPermission(context.ability, 'members.invite'), async () => {
      const links = await deps.repositories.watchPartyInviteLinks.list(roomId);
      return map(links, (found) => ({ items: found.map(toInviteLinkView) }));
    })
  );
}

export function revokeInviteLink(
  deps: LinkDeps,
  roomId: string,
  caller: PartyCaller,
  linkId: string
) {
  return actingAsMember(deps.context, roomId, caller, (context, memberKey) =>
    andThenAsync(requireRoomPermission(context.ability, 'members.invite'), async () => {
      const revoked = await deps.repositories.watchPartyInviteLinks.revoke(
        roomId,
        linkId,
        deps.now()
      );
      return andThenAsync(revoked, (changed) => {
        if (!changed) return err(watchPartyNotFound(roomId));
        logChange(deps, { roomId, actorKey: memberKey, action: 'invite-link.revoke' });
        return ok(undefined);
      });
    })
  );
}
