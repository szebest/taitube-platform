import type { PartyGuestSession } from '@vp/core/ports';
import type { WatchPartyInvite, WatchPartyInviteLink, WatchPartyPermission } from '@vp/domain';
import { MS_PER_DAY, MS_PER_HOUR } from '@vp/domain/time';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { OWNER, type WatchPartyTest } from './watch-party-test-deps';

export const OWNER_KEY = `user:${OWNER.id}`;
export const GUEST_ID = 'guestaaaaaaaaaaaaaaaa';
export const GUEST_KEY = `guest:${GUEST_ID}`;

export function guestSession(
  guestId = GUEST_ID,
  ipHash: string | null = 'ip:guest'
): PartyGuestSession {
  return { principal: { kind: 'guest', guestId, name: 'Guest 1000' }, ipHash };
}

export function userOf(index: number): UserContext {
  return { id: `00000000-0000-7000-8000-0000000e${String(index).padStart(4, '0')}`, role: 'USER' };
}

/** An invite link for a room, the token returned beside the stored row; `overrides` bend the row. */
export async function seedLink(
  { deps, repositories }: WatchPartyTest,
  roomId: string,
  overrides: Partial<WatchPartyInviteLink> = {}
): Promise<string> {
  const token = deps.secrets.newToken();
  const at = deps.now();
  expectOk(
    await repositories.watchPartyInviteLinks.create({
      id: deps.secrets.newId(),
      roomId,
      createdBy: OWNER_KEY,
      tokenHash: deps.secrets.hashToken(token),
      expiresAt: new Date(at.getTime() + MS_PER_HOUR),
      maxUses: null,
      uses: 0,
      revokedAt: null,
      createdAt: at,
      ...overrides,
    })
  );
  return token;
}

export async function seedInvite(
  { deps, repositories }: WatchPartyTest,
  roomId: string,
  invitee: UserContext,
  overrides: Partial<WatchPartyInvite> = {}
): Promise<WatchPartyInvite> {
  const at = deps.now();
  const invite: WatchPartyInvite = {
    id: deps.secrets.newId(),
    roomId,
    inviterId: OWNER.id,
    inviteeId: invitee.id,
    status: 'pending',
    watching: { names: [], count: 0 },
    expiresAt: new Date(at.getTime() + MS_PER_DAY),
    createdAt: at,
    ...overrides,
  };
  const payload = { type: 'pubsub', channel: 'party-invite', message: '{}' } as const;
  expectOk(await repositories.watchPartyInvites.create(invite, { kind: 'party_invite', payload }));
  return invite;
}

export async function banKey(
  { deps, repositories }: WatchPartyTest,
  roomId: string,
  memberKey: string,
  ipHash: string | null = null
): Promise<void> {
  const at = deps.now();
  expectOk(
    await repositories.watchPartyMembers.ban(
      { roomId, memberKey, ipHash, bannedBy: OWNER_KEY, reason: null, createdAt: at },
      {
        id: deps.secrets.newId(),
        line: { event: 'banned', actorKey: OWNER_KEY, targetKey: memberKey, detail: null },
        videoId: null,
        positionMs: null,
        createdAt: at,
      }
    )
  );
}

/** Puts `count` sockets in the room, as if that many members held it open now. */
export async function fillPresence(
  { deps, presence }: WatchPartyTest,
  roomId: string,
  count: number
): Promise<string[]> {
  const keys = Array.from({ length: count }, (_, index) => `user:filler-${index}`);
  for (const key of keys) {
    expectOk(
      await presence.admit(roomId, key, {
        limit: null,
        nowMs: deps.now().getTime(),
        staleBeforeMs: 0,
      })
    );
  }
  return keys;
}

function roleLine(test: WatchPartyTest, event: 'role_assigned' | 'roles_changed') {
  return {
    id: test.deps.secrets.newId(),
    line: { event, actorKey: OWNER_KEY, targetKey: null, detail: null },
    videoId: null,
    positionMs: null,
    createdAt: test.deps.now(),
  };
}

/** A custom grant role of the room, the id returned. */
export async function createRole(
  test: WatchPartyTest,
  roomId: string,
  {
    name,
    position,
    permissions,
  }: { name: string; position: number; permissions: WatchPartyPermission[] }
): Promise<string> {
  const id = test.deps.secrets.newId();
  expectOk(
    await test.repositories.watchPartyRoles.create(
      { id, roomId, key: null, kind: 'grant', name, colour: null, position, permissions },
      { at: test.deps.now(), line: roleLine(test, 'roles_changed') }
    )
  );
  return id;
}

export async function assignRoleId(
  test: WatchPartyTest,
  roomId: string,
  memberKey: string,
  roleId: string
): Promise<void> {
  const at = test.deps.now();
  expectOk(
    await test.repositories.watchPartyRoles.assign(
      { roomId, memberKey, roleId, grantedBy: OWNER_KEY, expiresAt: null, createdAt: at },
      { at, line: roleLine(test, 'role_assigned') }
    )
  );
}

/** Gives a member key one built-in role of the room. */
export async function assignRole(
  test: WatchPartyTest,
  roomId: string,
  memberKey: string,
  roleKey: 'moderator' | 'vip' | 'chat_muted' | 'cohost'
): Promise<void> {
  const roles = expectOk(await test.repositories.watchPartyRoles.list(roomId, test.deps.now()));
  const role = roles.find(({ key }) => key === roleKey);
  await assignRoleId(test, roomId, memberKey, role?.id ?? '');
}
