import { ErrorCodes } from '@vp/errors';
import {
  buildModerationApp,
  keyFor,
  type Method,
  type ModerationApp,
  ORGANIZER_PERMISSIONS,
  STALE,
  type Who,
} from '../../__tests__/watch-party-moderation-app';

const ESCALATION = ErrorCodes.WATCH_PARTY_ROLE_ESCALATION;
const PROTECTED = ErrorCodes.WATCH_PARTY_ROLE_PROTECTED;
const MISSING = ErrorCodes.WATCH_PARTY_PERMISSION_MISSING;

interface Room {
  readonly app: ModerationApp;
  readonly organizerRoleId: string;
  readonly lowerRoleId: string;
}

type Request = readonly [Method, string, Record<string, unknown>?];

async function setUpOrganizer(): Promise<Room> {
  const app = await buildModerationApp();
  const organizer = await app.call('owner', 'POST', '/roles', {
    name: 'Organizer',
    position: 450,
    permissions: ORGANIZER_PERMISSIONS,
  });
  const lower = await app.call('owner', 'POST', '/roles', {
    name: 'Lower',
    position: 350,
    permissions: ['chat.pin'],
  });
  const { id: organizerRoleId } = organizer.json();
  await app.call('owner', 'PUT', `/members/${keyFor('organizer')}/roles/${organizerRoleId}`, {});
  return { app, organizerRoleId, lowerRoleId: lower.json().id };
}

describe('an Organizer at position 450', () => {
  it.each([
    {
      scenario: 'creating a role that holds room.close',
      request: () => ['POST', '/roles', { name: 'Sneaky', permissions: ['room.close'] }],
      code: ESCALATION,
    },
    {
      scenario: 'editing a role to hold room.close',
      request: (c: Room) => [
        'PATCH',
        `/roles/${c.lowerRoleId}`,
        { permissions: ['room.close'], updatedAt: STALE },
      ],
      code: ESCALATION,
    },
    {
      scenario: 'editing Moderator',
      request: (c: Room) => [
        'PATCH',
        `/roles/${c.app.ids.moderator}`,
        { name: 'Boss', updatedAt: STALE },
      ],
      code: ESCALATION,
    },
    {
      scenario: 'moving Moderator',
      request: (c: Room) => [
        'PATCH',
        `/roles/${c.app.ids.moderator}`,
        { position: 300, updatedAt: STALE },
      ],
      code: ESCALATION,
    },
    {
      scenario: 'deleting Moderator',
      request: (c: Room) => ['DELETE', `/roles/${c.app.ids.moderator}`],
      code: PROTECTED,
    },
    {
      scenario: 'deleting a built-in role',
      request: (c: Room) => ['DELETE', `/roles/${c.app.ids.dj}`],
      code: PROTECTED,
    },
    {
      scenario: 'assigning Moderator',
      request: (c: Room) => [
        'PUT',
        `/members/${keyFor('member')}/roles/${c.app.ids.moderator}`,
        {},
      ],
      code: ESCALATION,
    },
    {
      scenario: 'revoking Moderator',
      request: (c: Room) => [
        'DELETE',
        `/members/${keyFor('moderator')}/roles/${c.app.ids.moderator}`,
      ],
      code: ESCALATION,
    },
    {
      scenario: 'moving Organizer to 650',
      request: (c: Room) => [
        'PATCH',
        `/roles/${c.organizerRoleId}`,
        { position: 650, updatedAt: STALE },
      ],
      code: ESCALATION,
    },
    {
      scenario: 'assigning Moderator to themselves',
      request: (c: Room) => [
        'PUT',
        `/members/${keyFor('organizer')}/roles/${c.app.ids.moderator}`,
        {},
      ],
      code: ESCALATION,
    },
    {
      scenario: 'muting a Moderator in chat',
      request: (c: Room) => [
        'PUT',
        `/members/${keyFor('moderator')}/roles/${c.app.ids.chat_muted}`,
        {},
      ],
      code: ESCALATION,
    },
    {
      scenario: 'assigning Chat muted despite chat.moderate',
      request: (c: Room) => [
        'PUT',
        `/members/${keyFor('member')}/roles/${c.app.ids.chat_muted}`,
        {},
      ],
      code: ESCALATION,
    },
    {
      scenario: 'kicking a Moderator',
      request: () => ['POST', `/members/${keyFor('moderator')}/kick`],
      code: MISSING,
    },
    {
      scenario: 'banning a Moderator',
      request: () => ['PUT', `/bans/${keyFor('moderator')}`, {}],
      code: MISSING,
    },
    {
      scenario: 'assigning Owner',
      request: (c: Room) => ['PUT', `/members/${keyFor('member')}/roles/${c.app.ids.owner}`, {}],
      code: ESCALATION,
    },
    {
      scenario: 'revoking Owner',
      request: (c: Room) => ['DELETE', `/members/${keyFor('owner')}/roles/${c.app.ids.owner}`],
      code: ESCALATION,
    },
    {
      scenario: 'editing Owner',
      request: (c: Room) => [
        'PATCH',
        `/roles/${c.app.ids.owner}`,
        { name: 'Mine', updatedAt: STALE },
      ],
      code: ESCALATION,
    },
    {
      scenario: 'demoting the owner',
      request: (c: Room) => [
        'PATCH',
        `/roles/${c.app.ids.owner}`,
        { permissions: [], updatedAt: STALE },
      ],
      code: ESCALATION,
    },
    {
      scenario: 'transferring ownership',
      request: () => ['POST', '/owner', { memberKey: keyFor('organizer') }],
      code: ESCALATION,
    },
  ] satisfies { scenario: string; request: (room: Room) => Request; code: string }[])(
    'is refused $scenario',
    async ({ request, code }) => {
      const room = await setUpOrganizer();
      const [method, path, payload] = request(room);

      const res = await room.app.call('organizer', method, path, payload);

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe(code);
    }
  );

  it('cannot lift their own Chat muted', async () => {
    const room = await setUpOrganizer();
    await room.app.give('organizer', 'chat_muted');

    const res = await room.app.call(
      'organizer',
      'DELETE',
      `/members/${keyFor('organizer')}/roles/${room.app.ids.chat_muted}`
    );

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(ESCALATION);
  });
});

describe('the built-in ladder', () => {
  it.each([
    {
      who: 'moderator',
      scenario: 'a Moderator assigning Co-host',
      request: (a: ModerationApp) => [
        'PUT',
        `/members/${keyFor('member')}/roles/${a.ids.cohost}`,
        {},
      ],
      code: ESCALATION,
    },
    {
      who: 'moderator',
      scenario: 'a Moderator muting a Co-host',
      request: (a: ModerationApp) => [
        'PUT',
        `/members/${keyFor('cohost')}/roles/${a.ids.chat_muted}`,
        {},
      ],
      code: ESCALATION,
    },
    {
      who: 'moderator',
      scenario: 'a Moderator editing a role',
      request: (a: ModerationApp) => [
        'PATCH',
        `/roles/${a.ids.dj}`,
        { name: 'Selector', updatedAt: STALE },
      ],
      code: MISSING,
    },
    {
      who: 'cohost',
      scenario: 'a Co-host closing the room',
      request: () => ['POST', '/close', {}],
      code: MISSING,
    },
    {
      who: 'cohost',
      scenario: 'a Co-host editing a role',
      request: (a: ModerationApp) => [
        'PATCH',
        `/roles/${a.ids.dj}`,
        { name: 'Selector', updatedAt: STALE },
      ],
      code: MISSING,
    },
    {
      who: 'cohost',
      scenario: 'a Co-host applying a preset',
      request: () => ['POST', '/roles/preset', { preset: 'public' }],
      code: MISSING,
    },
    {
      who: 'dj',
      scenario: 'a DJ assigning any role',
      request: (a: ModerationApp) => ['PUT', `/members/${keyFor('member')}/roles/${a.ids.vip}`, {}],
      code: MISSING,
    },
  ] satisfies {
    who: Who;
    scenario: string;
    request: (app: ModerationApp) => Request;
    code: string;
  }[])('refuses $scenario', async ({ who, request, code }) => {
    const app = await buildModerationApp();
    const [method, path, payload] = request(app);

    const res = await app.call(who, method, path, payload);

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(code);
  });
});
