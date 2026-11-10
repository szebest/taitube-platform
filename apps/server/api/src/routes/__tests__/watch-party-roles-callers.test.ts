import { ErrorCodes } from '@vp/errors';
import {
  ABSENT_KEY,
  buildModerationApp,
  keyFor,
  type Method,
  type ModerationApp,
  STALE,
} from '../../__tests__/watch-party-moderation-app';

const ESCALATION = ErrorCodes.WATCH_PARTY_ROLE_ESCALATION;
const MISSING = ErrorCodes.WATCH_PARTY_PERMISSION_MISSING;

type Request = readonly [Method, string, Record<string, unknown>?];

describe('a plain member and a stranger', () => {
  it.each(['member', 'stranger'] as const)(
    '%s is refused every role and moderation route',
    async (who) => {
      const app = await buildModerationApp();
      const requests: Request[] = [
        ['POST', '/roles', { name: 'x', permissions: [] }],
        ['PUT', `/members/${keyFor('other')}/roles/${app.ids.vip}`, {}],
        ['POST', `/members/${keyFor('other')}/kick`],
        ['PUT', `/bans/${keyFor('other')}`, {}],
        ['DELETE', `/bans/${keyFor('other')}`],
        ['POST', '/guests/remove'],
        ['POST', '/owner', { memberKey: keyFor('other') }],
      ];

      const statuses = await Promise.all(
        requests.map(
          async ([method, path, payload]) => (await app.call(who, method, path, payload)).statusCode
        )
      );

      expect(statuses).toEqual(requests.map(() => 403));
    }
  );

  it.each([
    { method: 'POST', path: '/roles', payload: { name: 'x', permissions: [] } },
    {
      method: 'PUT',
      path: `/members/${ABSENT_KEY}/roles/018f0000-0000-7000-8000-0000000000ff`,
      payload: {},
    },
    { method: 'POST', path: `/members/${ABSENT_KEY}/kick`, payload: undefined },
    { method: 'PUT', path: `/bans/${ABSENT_KEY}`, payload: {} },
    { method: 'POST', path: '/owner', payload: { memberKey: ABSENT_KEY } },
  ] as const)('signed out is 401 on $method $path', async ({ method, path, payload }) => {
    const app = await buildModerationApp();

    const res = await app.call('anonymous', method, path, payload);

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });
});

describe('a platform MODERATOR in a room they hold no seat in', () => {
  it.each([
    { scenario: 'kick a member', request: () => ['POST', `/members/${keyFor('member')}/kick`] },
    { scenario: 'ban a member', request: () => ['PUT', `/bans/${keyFor('member')}`, {}] },
    { scenario: 'unban a member', request: () => ['DELETE', `/bans/${keyFor('member')}`] },
    {
      scenario: 'mute a member in chat',
      request: (a: ModerationApp) => [
        'PUT',
        `/members/${keyFor('member')}/roles/${a.ids.chat_muted}`,
        {},
      ],
    },
    { scenario: 'remove every guest', request: () => ['POST', '/guests/remove'] },
  ] satisfies { scenario: string; request: (app: ModerationApp) => Request }[])(
    'can $scenario',
    async ({ request }) => {
      const app = await buildModerationApp();
      const [method, path, payload] = request(app);

      const res = await app.call('platformModerator', method, path, payload);

      expect(res.statusCode).toBe(204);
    }
  );

  it.each([
    {
      scenario: 'create a role',
      request: () => ['POST', '/roles', { name: 'x', permissions: [] }],
      code: MISSING,
    },
    {
      scenario: 'assign DJ',
      request: (a: ModerationApp) => ['PUT', `/members/${keyFor('member')}/roles/${a.ids.dj}`, {}],
      code: MISSING,
    },
    {
      scenario: 'revoke DJ',
      request: (a: ModerationApp) => ['DELETE', `/members/${keyFor('dj')}/roles/${a.ids.dj}`],
      code: MISSING,
    },
    {
      scenario: 'edit a role',
      request: (a: ModerationApp) => [
        'PATCH',
        `/roles/${a.ids.dj}`,
        { name: 'x', updatedAt: STALE },
      ],
      code: MISSING,
    },
    {
      scenario: 'kick the owner',
      request: () => ['POST', `/members/${keyFor('owner')}/kick`],
      code: ESCALATION,
    },
  ] satisfies { scenario: string; request: (app: ModerationApp) => Request; code: string }[])(
    'cannot $scenario',
    async ({ request, code }) => {
      const app = await buildModerationApp();
      const [method, path, payload] = request(app);

      const res = await app.call('platformModerator', method, path, payload);

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe(code);
    }
  );
});

describe('a guest', () => {
  it.each(['dj', 'chat_muted', 'moderator', 'vip'] as const)('is refused %s', async (role) => {
    const app = await buildModerationApp();

    const res = await app.call(
      'owner',
      'PUT',
      `/members/${app.guestKey}/roles/${app.ids[role]}`,
      {}
    );

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(ESCALATION);
  });
});
