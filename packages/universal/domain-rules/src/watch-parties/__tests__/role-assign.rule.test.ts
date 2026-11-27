import { ErrorCodes } from '@vp/errors';
import { MODERATOR } from '../../__tests__/entities';
import { decideRoleAssign, decideRoleRevoke, type RoleAssignInput } from '../role-assign.rule';
import { type Holder, memberAt, roleOf, seatOf } from './room-fixtures';

type Case = {
  scenario: string;
  holder: Holder;
  role: Holder;
  target: ReturnType<typeof memberAt>;
  code: string | null;
};

const SELF = 'user:actor';

function inputOf({ holder, role, target }: Case): RoleAssignInput {
  return { ability: seatOf(holder).ability, actorKey: SELF, target, role: roleOf(role) };
}

const codeOf = (result: ReturnType<typeof decideRoleAssign>) =>
  result.ok ? null : result.error.code;

describe('@vp/domain-rules: decideRoleAssign', () => {
  it.each<Case>([
    {
      scenario: 'the organizer assigns DJ to a member',
      holder: 'organizer',
      role: 'dj',
      target: memberAt(1),
      code: null,
    },
    {
      scenario: 'the organizer assigns Moderator',
      holder: 'organizer',
      role: 'moderator',
      target: memberAt(1),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the organizer assigns Moderator to itself',
      holder: 'organizer',
      role: 'moderator',
      target: memberAt(450, { memberKey: SELF }),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the organizer mutes a member despite Chat muted sitting above it',
      holder: 'organizer',
      role: 'chat_muted',
      target: memberAt(1),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the organizer mutes a moderator',
      holder: 'organizer',
      role: 'chat_muted',
      target: memberAt(600),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: "the organizer changes a moderator's roles",
      holder: 'organizer',
      role: 'dj',
      target: memberAt(600),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the owner assigns Owner',
      holder: 'owner',
      role: 'owner',
      target: memberAt(1),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the owner assigns a role to a guest',
      holder: 'owner',
      role: 'dj',
      target: memberAt(0, { kind: 'guest' }),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'a moderator assigns Co-host',
      holder: 'moderator',
      role: 'cohost',
      target: memberAt(1),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'a moderator mutes a member in chat',
      holder: 'moderator',
      role: 'chat_muted',
      target: memberAt(400),
      code: null,
    },
    {
      scenario: 'a moderator mutes a co-host',
      holder: 'moderator',
      role: 'chat_muted',
      target: memberAt(800),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'a DJ assigns Speaker',
      holder: 'dj',
      role: 'speaker',
      target: memberAt(1),
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
    {
      scenario: 'the owner assigns Co-host',
      holder: 'owner',
      role: 'cohost',
      target: memberAt(600),
      code: null,
    },
  ])('$scenario: $code', (row) => {
    expect(codeOf(decideRoleAssign(inputOf(row)))).toBe(row.code);
  });

  it.each([
    { role: 'chat_muted' as const, code: null },
    { role: 'dj' as const, code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING },
  ])('lets platform staff without a seat assign $role: $code', ({ role, code }) => {
    const ability = seatOf('guest', MODERATOR).ability;
    const result = decideRoleAssign({
      ability,
      actorKey: SELF,
      target: memberAt(800),
      role: roleOf(role),
    });

    expect(codeOf(result)).toBe(code);
  });
});

describe('@vp/domain-rules: decideRoleRevoke', () => {
  it.each<Case>([
    {
      scenario: 'a DJ drops their own DJ',
      holder: 'dj',
      role: 'dj',
      target: memberAt(400, { memberKey: SELF }),
      code: null,
    },
    {
      scenario: 'a chat-muted member lifts their own mute',
      holder: 'chat_muted',
      role: 'chat_muted',
      target: memberAt(1, { memberKey: SELF }),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the organizer revokes Moderator',
      holder: 'organizer',
      role: 'moderator',
      target: memberAt(600),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the organizer revokes Owner',
      holder: 'organizer',
      role: 'owner',
      target: memberAt(1000, { isOwner: true }),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the owner demotes themselves out of Owner',
      holder: 'owner',
      role: 'owner',
      target: memberAt(1000, { isOwner: true, memberKey: SELF }),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: "a moderator lifts a member's chat mute",
      holder: 'moderator',
      role: 'chat_muted',
      target: memberAt(1),
      code: null,
    },
  ])('$scenario: $code', (row) => {
    expect(codeOf(decideRoleRevoke(inputOf(row)))).toBe(row.code);
  });
});
