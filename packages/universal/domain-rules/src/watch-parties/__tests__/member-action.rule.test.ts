import { ErrorCodes } from '@vp/errors';
import { decideMemberAction, decideOwnerTransfer, type MemberAction } from '../member-action.rule';
import { type Holder, memberAt, seatOf } from './room-fixtures';

const SELF = 'user:actor';

describe('@vp/domain-rules: decideMemberAction', () => {
  it.each<{
    scenario: string;
    holder: Holder;
    action: MemberAction;
    target: ReturnType<typeof memberAt>;
    code: string | null;
  }>([
    {
      scenario: 'a moderator kicks a member',
      holder: 'moderator',
      action: 'kick',
      target: memberAt(1),
      code: null,
    },
    {
      scenario: 'a moderator bans a guest',
      holder: 'moderator',
      action: 'ban',
      target: memberAt(0, { kind: 'guest' }),
      code: null,
    },
    {
      scenario: 'the organizer kicks a moderator',
      holder: 'organizer',
      action: 'kick',
      target: memberAt(600),
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
    {
      scenario: 'a moderator bans a moderator',
      holder: 'moderator',
      action: 'ban',
      target: memberAt(600),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'a co-host kicks the owner',
      holder: 'cohost',
      action: 'kick',
      target: memberAt(1000, { isOwner: true }),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'a moderator kicks themselves',
      holder: 'moderator',
      action: 'kick',
      target: memberAt(600, { memberKey: SELF }),
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
  ])('$scenario: $code', ({ holder, action, target, code }) => {
    const result = decideMemberAction({
      ability: seatOf(holder).ability,
      actorKey: SELF,
      action,
      target,
    });

    expect(result.ok ? null : result.error.code).toBe(code);
  });
});

describe('@vp/domain-rules: decideOwnerTransfer', () => {
  it.each([
    { scenario: 'the owner to a member', actorIsOwner: true, target: memberAt(1), ok: true },
    {
      scenario: 'a co-host to themselves',
      actorIsOwner: false,
      target: memberAt(800, { memberKey: SELF }),
      ok: false,
    },
    {
      scenario: 'the owner to a guest',
      actorIsOwner: true,
      target: memberAt(0, { kind: 'guest' }),
      ok: false,
    },
    {
      scenario: 'the owner to themselves',
      actorIsOwner: true,
      target: memberAt(1000, { memberKey: SELF }),
      ok: false,
    },
  ])('transfers from $scenario: $ok', ({ actorIsOwner, target, ok }) => {
    expect(decideOwnerTransfer({ actorIsOwner, actorKey: SELF, target }).ok).toBe(ok);
  });
});
