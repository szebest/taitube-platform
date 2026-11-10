import type { WatchPartyPermission } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  decideRoleCreate,
  decideRoleDelete,
  decideRoleUpdate,
  type RoleDraft,
  type RolePatch,
} from '../role-edit.rule';
import { type Holder, ROLES, ROOM_ID, roleOf, seatOf } from './room-fixtures';

function contextOf(holder: Holder) {
  const { ability, topPosition, isOwner } = seatOf(holder);
  return { roomId: ROOM_ID, ability, topPosition, isOwner, roles: ROLES };
}

const draftOf = (overrides: Partial<RoleDraft> = {}): RoleDraft => ({
  kind: 'grant',
  permissions: ['chat.moderate'],
  ...overrides,
});

describe('@vp/domain-rules: decideRoleCreate', () => {
  it.each([
    {
      scenario: 'at the highest free slot below the editor',
      holder: 'organizer' as const,
      draft: {},
      position: 449,
    },
    {
      scenario: 'at a chosen free slot',
      holder: 'organizer' as const,
      draft: { position: 100 },
      position: 100,
    },
    {
      scenario: 'by the owner',
      holder: 'owner' as const,
      draft: { permissions: ['room.close'] as WatchPartyPermission[] },
      position: 999,
    },
  ])('creates a role $scenario', ({ holder, draft, position }) => {
    expect(expectOk(decideRoleCreate(contextOf(holder), draftOf(draft)))).toEqual({ position });
  });

  it.each([
    {
      scenario: 'holding room.close, which the editor lacks',
      holder: 'organizer' as const,
      draft: { permissions: ['room.close'] as WatchPartyPermission[] },
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: "at the editor's own position",
      holder: 'organizer' as const,
      draft: { position: 450 },
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'without roles.manage',
      holder: 'cohost' as const,
      draft: {},
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
    {
      scenario: 'at a taken slot',
      holder: 'owner' as const,
      draft: { position: 400 },
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses a role $scenario', ({ holder, draft, code }) => {
    expect(expectErr(decideRoleCreate(contextOf(holder), draftOf(draft))).code).toBe(code);
  });

  it('refuses the fifteenth custom role', () => {
    const fourteen = Array.from({ length: 14 }, (_, index) => ({
      ...roleOf('organizer'),
      id: `custom-${index}`,
      position: 10 + index,
    }));
    const context = {
      ...contextOf('owner'),
      roles: [...ROLES.filter((role) => role.key), ...fourteen],
    };

    expect(expectErr(decideRoleCreate(context, draftOf())).code).toBe(
      ErrorCodes.WATCH_PARTY_ROLE_LIMIT
    );
  });
});

describe('@vp/domain-rules: decideRoleUpdate', () => {
  it.each<{ scenario: string; holder: Holder; role: string; patch: RolePatch }>([
    {
      scenario: 'the owner renames Owner',
      holder: 'owner',
      role: 'owner',
      patch: { name: 'Host', colour: '#000000' },
    },
    {
      scenario: 'the organizer edits DJ',
      holder: 'organizer',
      role: 'dj',
      patch: { permissions: ['chat.moderate'] },
    },
    {
      scenario: 'the organizer moves DJ below itself',
      holder: 'organizer',
      role: 'dj',
      patch: { position: 420 },
    },
    {
      scenario: 'the owner limits Guest to its ceiling',
      holder: 'owner',
      role: 'guest',
      patch: { permissions: [] },
    },
    {
      scenario: 'the organizer keeps a permission it lacks on a role it edits',
      holder: 'organizer',
      role: 'dj',
      patch: { permissions: ['queue.skip'] },
    },
  ])('lets $scenario', ({ holder, role, patch }) => {
    expect(decideRoleUpdate(contextOf(holder), roleOf(role as Holder), patch).ok).toBe(true);
  });

  it.each<{ scenario: string; holder: Holder; role: string; patch: RolePatch; code: string }>([
    {
      scenario: 'the organizer edits Moderator',
      holder: 'organizer',
      role: 'moderator',
      patch: { name: 'Mods' },
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the organizer moves Moderator',
      holder: 'organizer',
      role: 'moderator',
      patch: { position: 100 },
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the organizer moves itself to 650',
      holder: 'organizer',
      role: 'organizer',
      patch: { position: 650 },
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the organizer adds room.close to DJ',
      holder: 'organizer',
      role: 'dj',
      patch: { permissions: ['room.close'] },
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the organizer edits Owner',
      holder: 'organizer',
      role: 'owner',
      patch: { name: 'Mine' },
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: "the owner edits Owner's permissions",
      holder: 'owner',
      role: 'owner',
      patch: { permissions: [] },
      code: ErrorCodes.WATCH_PARTY_ROLE_PROTECTED,
    },
    {
      scenario: 'the owner moves Member',
      holder: 'owner',
      role: 'member',
      patch: { position: 5 },
      code: ErrorCodes.WATCH_PARTY_ROLE_PROTECTED,
    },
    {
      scenario: 'the owner puts chat.post into Guest',
      holder: 'owner',
      role: 'guest',
      patch: { permissions: ['voice.join', 'chat.post'] },
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'a moderator edits a role',
      holder: 'moderator',
      role: 'dj',
      patch: { name: 'Drivers' },
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
    {
      scenario: 'a co-host edits a role',
      holder: 'cohost',
      role: 'dj',
      patch: { name: 'Drivers' },
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
  ])('refuses $scenario', ({ holder, role, patch, code }) => {
    expect(expectErr(decideRoleUpdate(contextOf(holder), roleOf(role as Holder), patch)).code).toBe(
      code
    );
  });
});

describe('@vp/domain-rules: decideRoleDelete', () => {
  it.each([
    {
      scenario: 'the owner deletes a custom role',
      holder: 'owner' as const,
      role: 'organizer' as const,
      code: null,
    },
    {
      scenario: 'the owner deletes a built-in role',
      holder: 'owner' as const,
      role: 'dj' as const,
      code: ErrorCodes.WATCH_PARTY_ROLE_PROTECTED,
    },
    {
      scenario: 'the organizer deletes itself',
      holder: 'organizer' as const,
      role: 'organizer' as const,
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
  ])('$scenario: $code', ({ holder, role, code }) => {
    const result = decideRoleDelete(contextOf(holder), roleOf(role));

    expect(result.ok ? null : result.error.code).toBe(code);
  });
});
