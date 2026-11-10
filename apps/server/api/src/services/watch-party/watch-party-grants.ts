import type { WatchPartyInviteLink } from '@vp/domain';
import type { JoinGrant } from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  type WatchPartyInviteInvalid,
  watchPartyInviteInvalid,
} from '@vp/errors';
import { andThenAsync, assertNever, err, isErr, map, ok, type Result } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';

export type Grant =
  | { readonly type: 'none' }
  | { readonly type: 'invalid' }
  | { readonly type: 'invite'; readonly inviteId: string }
  | { readonly type: 'link'; readonly linkId: string };

type GrantDeps = Pick<WatchPartyDeps, 'repositories' | 'secrets' | 'now'>;

export interface GrantAsk {
  readonly roomId: string;
  readonly userId: string | null;
  readonly invite: string | undefined;
}

export function joinGrantOf(grant: Grant): JoinGrant {
  switch (grant.type) {
    case 'none':
      return null;
    case 'invalid':
      return 'invalid';
    case 'invite':
      return 'invite';
    case 'link':
      return 'invite_link';
    default:
      return assertNever(grant, 'Grant');
  }
}

function isUsable(link: WatchPartyInviteLink, roomId: string, now: Date): boolean {
  return (
    link.roomId === roomId &&
    link.revokedAt === null &&
    link.expiresAt > now &&
    (link.maxUses === null || link.uses < link.maxUses)
  );
}

async function linkGrant(
  { repositories, secrets, now }: GrantDeps,
  roomId: string,
  token: string
): Promise<Result<Grant, DatabaseUnavailable>> {
  const link = await repositories.watchPartyInviteLinks.findByTokenHash(secrets.hashToken(token));
  return map(link, (found) =>
    found !== null && isUsable(found, roomId, now())
      ? { type: 'link', linkId: found.id }
      : { type: 'invalid' }
  );
}

export async function findGrant(
  deps: GrantDeps,
  { roomId, userId, invite }: GrantAsk
): Promise<Result<Grant, DatabaseUnavailable>> {
  if (invite === undefined) return ok({ type: 'none' });
  if (userId !== null) {
    const pending = await deps.repositories.watchPartyInvites.findValid(roomId, userId, deps.now());
    if (isErr(pending)) return pending;
    if (pending.value?.id === invite) return ok({ type: 'invite', inviteId: pending.value.id });
  }
  return linkGrant(deps, roomId, invite);
}

/**
 * A link counts one use before the seat is taken, and answers invalid when a racing join took the
 * last one; any other grant has nothing to claim.
 */
export async function claimGrant(
  { repositories, now }: GrantDeps,
  roomId: string,
  grant: Grant
): Promise<Result<void, WatchPartyInviteInvalid | DatabaseUnavailable>> {
  if (grant.type !== 'link') return ok();
  const used = await repositories.watchPartyInviteLinks.use(grant.linkId, now());
  return andThenAsync(used, (spent) => (spent ? ok() : err(watchPartyInviteInvalid(roomId))));
}

export async function settleGrant(
  { repositories }: Pick<GrantDeps, 'repositories'>,
  grant: Grant
): Promise<Result<void, DatabaseUnavailable>> {
  if (grant.type !== 'invite') return ok();
  return repositories.watchPartyInvites.markJoined(grant.inviteId);
}
