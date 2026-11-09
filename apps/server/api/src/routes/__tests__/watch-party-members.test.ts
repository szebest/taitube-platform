import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  ABSENT_KEY,
  buildModerationApp,
  keyFor,
  type ModerationApp,
} from '../../__tests__/watch-party-moderation-app';
import { GUEST_IP_HASH } from '../../services/watch-party/__tests__/watch-party-moderation-fixture';

const SECOND_GUEST = 'guest:second-guest-0001';

const seatOf = async (app: ModerationApp, memberKey: string) =>
  expectOk(await app.repositories.watchPartyMembers.find(app.roomId, memberKey));

const seated = async (app: ModerationApp) =>
  expectOk(await app.repositories.watchPartyMembers.listSeated(app.roomId)).map(
    ({ memberKey }) => memberKey
  );

describe('kicking', () => {
  it('lets a Moderator kick a member, who is told and may rejoin', async () => {
    const app = await buildModerationApp();
    const frames = await app.collect();

    const res = await app.call('moderator', 'POST', `/members/${keyFor('member')}/kick`);

    expect(res.statusCode).toBe(204);
    expect((await seatOf(app, keyFor('member')))?.leftAt).not.toBeNull();
    expect(frames).toEqual([{ type: 'kicked' }]);
    expect(
      expectOk(
        await app.repositories.watchPartyMembers.isBanned(app.roomId, keyFor('member'), null)
      )
    ).toBe(false);
  });

  it.each([
    {
      scenario: 'the owner',
      target: keyFor('owner'),
      status: 403,
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'a Co-host above them',
      target: keyFor('cohost'),
      status: 403,
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'themselves',
      target: keyFor('moderator'),
      status: 403,
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'a key with no seat',
      target: ABSENT_KEY,
      status: 404,
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
    {
      scenario: 'something that is no key',
      target: 'nobody',
      status: 400,
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses a Moderator kicking $scenario', async ({ target, status, code }) => {
    const app = await buildModerationApp();

    const res = await app.call('moderator', 'POST', `/members/${target}/kick`);

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
  });
});

describe('removing guests', () => {
  it('removes one guest, then every guest, and leaves the accounts seated', async () => {
    const app = await buildModerationApp();
    await app.repositories.watchPartyMembers.join(
      {
        roomId: app.roomId,
        memberKey: SECOND_GUEST,
        kind: 'guest',
        userId: null,
        discordUserId: null,
        displayName: 'Guest 5555',
        avatarUrl: null,
        ipHash: null,
        joinedVia: 'link',
        joinedAt: new Date(),
      },
      null
    );
    const frames = await app.collect();

    const one = await app.call('moderator', 'POST', `/members/${app.guestKey}/kick`);
    expect(one.statusCode).toBe(204);
    expect(await seated(app)).toContain(SECOND_GUEST);
    expect(await seated(app)).not.toContain(app.guestKey);

    const rest = await app.call('moderator', 'POST', '/guests/remove');

    expect(rest.statusCode).toBe(204);
    expect(await seated(app)).not.toContain(SECOND_GUEST);
    expect(await seated(app)).toContain(keyFor('member'));
    expect(frames).toEqual([{ type: 'kicked' }, { type: 'kicked' }]);
  });
});

describe('banning', () => {
  it('bans a guest by key and by the address their seat kept, then lifts it', async () => {
    const app = await buildModerationApp();
    const members = app.repositories.watchPartyMembers;

    const ban = await app.call('moderator', 'PUT', `/bans/${app.guestKey}`, { reason: 'spam' });

    expect(ban.statusCode).toBe(204);
    expect(expectOk(await members.isBanned(app.roomId, app.guestKey, null))).toBe(true);
    expect(
      expectOk(await members.isBanned(app.roomId, 'guest:another-credential', GUEST_IP_HASH))
    ).toBe(true);
    expect((await seatOf(app, app.guestKey))?.leftAt).not.toBeNull();

    const lifted = await app.call('moderator', 'DELETE', `/bans/${app.guestKey}`);

    expect(lifted.statusCode).toBe(204);
    expect(expectOk(await members.isBanned(app.roomId, app.guestKey, GUEST_IP_HASH))).toBe(false);
  });

  it.each([
    {
      scenario: 'the owner',
      target: keyFor('owner'),
      status: 403,
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'a key with no seat',
      target: ABSENT_KEY,
      status: 404,
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
  ])('refuses a Moderator banning $scenario', async ({ target, status, code }) => {
    const app = await buildModerationApp();

    const res = await app.call('moderator', 'PUT', `/bans/${target}`, {});

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
  });
});

describe('transferring ownership', () => {
  it('makes the target owner and leaves the previous owner Co-host', async () => {
    const app = await buildModerationApp();
    const frames = await app.collect();
    const before = (await app.roles()).rolesVersion;

    const res = await app.call('owner', 'POST', '/owner', { memberKey: keyFor('member') });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ownerKey: keyFor('member'), rolesVersion: before + 1 });
    expect(frames.map(({ type }) => type)).toEqual(['owner', 'member.roles']);
    const room = expectOk(await app.repositories.watchPartyRooms.findById(app.roomId));
    expect(room?.ownerKey).toBe(keyFor('member'));
    const held = expectOk(
      await app.repositories.watchPartyRoles.assignmentsOf(app.roomId, keyFor('owner'))
    );
    expect(held.map(({ roleId }) => roleId)).toEqual([app.ids.cohost]);

    const asPreviousOwner = await app.call('owner', 'POST', '/roles', {
      name: 'x',
      permissions: [],
    });
    const asNewOwner = await app.call('member', 'POST', '/roles', { name: 'x', permissions: [] });

    expect(asPreviousOwner.statusCode).toBe(403);
    expect(asNewOwner.statusCode).toBe(201);
  });

  it.each([
    {
      scenario: 'a Co-host',
      who: 'cohost',
      target: keyFor('member'),
      status: 403,
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the owner to a guest',
      who: 'owner',
      target: 'guest:abcdefghijklmnop',
      status: 403,
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the owner to themselves',
      who: 'owner',
      target: keyFor('owner'),
      status: 403,
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
    {
      scenario: 'the owner to a key with no seat',
      who: 'owner',
      target: ABSENT_KEY,
      status: 404,
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
  ] as const)('refuses $scenario', async ({ who, target, status, code }) => {
    const app = await buildModerationApp();

    const res = await app.call(who, 'POST', '/owner', { memberKey: target });

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
    const room = expectOk(await app.repositories.watchPartyRooms.findById(app.roomId));
    expect(room?.ownerKey).toBe(keyFor('owner'));
  });
});
