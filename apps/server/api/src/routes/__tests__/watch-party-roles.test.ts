import { BUILT_IN_ROLES, WATCH_PARTY_PERMISSION_IDS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  buildModerationApp,
  keyFor,
  type ModerationApp,
  STALE,
} from '../../__tests__/watch-party-moderation-app';

const PUBLIC_MEMBER = ['playback.request', 'queue.vote', 'chat.post', 'chat.react', 'voice.join'];
const MINUTE_MS = 60_000;

const popcorn = { name: 'Popcorn crew', permissions: ['chat.pin'] };

async function updatedAtOf(app: ModerationApp, roleId: string) {
  return (await app.roles()).items.find(({ id }) => id === roleId)?.updatedAt ?? STALE;
}

describe('listing the roles', () => {
  it.each([
    { who: 'member', status: 200 },
    { who: 'stranger', status: 404 },
    { who: 'anonymous', status: 404 },
  ] as const)('answers $status to $who', async ({ who, status }) => {
    const app = await buildModerationApp();

    const res = await app.call(who, 'GET', '/roles');

    expect(res.statusCode).toBe(status);
    if (status === 404) expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
  });

  it('lists the eleven built-in roles highest first with the versions', async () => {
    const app = await buildModerationApp();

    const { items, rolesVersion } = await app.roles();

    expect(items.map(({ key }) => key)).toEqual(BUILT_IN_ROLES.map(({ key }) => key));
    expect(items.map(({ position }) => position)).toEqual(
      BUILT_IN_ROLES.map(({ position }) => position)
    );
    expect(rolesVersion).toBe(3);
  });
});

describe('creating, editing and deleting a role', () => {
  it('walks a custom role through its whole life', async () => {
    const app = await buildModerationApp();

    const created = await app.call('owner', 'POST', '/roles', popcorn);
    expect(created.statusCode).toBe(201);
    const { id } = created.json();

    const edited = await app.call('owner', 'PATCH', `/roles/${id}`, {
      name: 'Snack crew',
      colour: '#112233',
      updatedAt: created.json().updatedAt,
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({ id, name: 'Snack crew', colour: '#112233' });

    expect((await app.call('owner', 'DELETE', `/roles/${id}`)).statusCode).toBe(204);
    expect((await app.roles()).items.some((role) => role.id === id)).toBe(false);
  });

  it('answers 409 VERSION_CONFLICT to an edit made on a stale updatedAt', async () => {
    const app = await buildModerationApp();
    const { id } = (await app.call('owner', 'POST', '/roles', popcorn)).json();

    const res = await app.call('owner', 'PATCH', `/roles/${id}`, {
      name: 'Late',
      updatedAt: STALE,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe(ErrorCodes.VERSION_CONFLICT);
  });

  it.each([
    {
      method: 'PATCH',
      code: ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND,
      payload: { name: 'x', updatedAt: STALE },
    },
    { method: 'DELETE', code: ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND, payload: undefined },
  ] as const)(
    'answers 404 to $method of a role the room lacks',
    async ({ method, code, payload }) => {
      const app = await buildModerationApp();

      const res = await app.call(
        'owner',
        method,
        '/roles/018f0000-0000-7000-8000-0000000000ff',
        payload
      );

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe(code);
    }
  );

  it.each([
    { scenario: 'a blank name', payload: { ...popcorn, name: ' ' }, status: 422 },
    {
      scenario: 'an unknown permission',
      payload: { ...popcorn, permissions: ['everything'] },
      status: 400,
    },
    {
      scenario: 'a colour that is not #rrggbb',
      payload: { ...popcorn, colour: 'red' },
      status: 400,
    },
  ])('refuses $scenario with $status', async ({ payload, status }) => {
    const app = await buildModerationApp();

    const res = await app.call('owner', 'POST', '/roles', payload);

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});

describe('the built-in roles', () => {
  const keys = BUILT_IN_ROLES.map(({ key }) => ({ key }));

  it.each(keys)('cannot delete $key', async ({ key }) => {
    const app = await buildModerationApp();

    const res = await app.call('owner', 'DELETE', `/roles/${app.ids[key]}`);

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_ROLE_PROTECTED);
  });

  it.each(keys)('lets the owner rename and recolour $key', async ({ key }) => {
    const app = await buildModerationApp();

    const res = await app.call('owner', 'PATCH', `/roles/${app.ids[key]}`, {
      name: `The ${key}`,
      colour: '#abcdef',
      updatedAt: await updatedAtOf(app, app.ids[key]),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ key, name: `The ${key}`, colour: '#abcdef' });
  });

  it.each([
    { scenario: 'permissions', payload: { permissions: [] } },
    { scenario: 'position', payload: { position: 999 } },
  ])("refuses to edit Owner's $scenario", async ({ payload }) => {
    const app = await buildModerationApp();

    const res = await app.call('owner', 'PATCH', `/roles/${app.ids.owner}`, {
      ...payload,
      updatedAt: await updatedAtOf(app, app.ids.owner),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_ROLE_PROTECTED);
  });

  it.each([
    { permissions: ['voice.join'], status: 200, code: undefined },
    { permissions: ['chat.post'], status: 403, code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION },
    {
      permissions: ['voice.join', 'queue.add'],
      status: 403,
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
  ])('answers $status to Guest holding $permissions', async ({ permissions, status, code }) => {
    const app = await buildModerationApp();

    const res = await app.call('owner', 'PATCH', `/roles/${app.ids.guest}`, {
      permissions,
      updatedAt: await updatedAtOf(app, app.ids.guest),
    });

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
  });
});

describe('presets', () => {
  it('gives a public room`s Member exactly the public set', async () => {
    const app = await buildModerationApp('public');

    const member = (await app.roles()).items.find(({ key }) => key === 'member');

    expect([...(member?.permissions ?? [])].sort()).toEqual([...PUBLIC_MEMBER].sort());
  });

  it('applies a preset again: built-ins reset, Owner and custom roles and assignments stay', async () => {
    const app = await buildModerationApp();
    const { id: customId } = (await app.call('owner', 'POST', '/roles', popcorn)).json();
    await app.give('member', 'vip');
    const edited = await app.call('owner', 'PATCH', `/roles/${app.ids.dj}`, {
      permissions: ['chat.pin'],
      updatedAt: await updatedAtOf(app, app.ids.dj),
    });
    expect(edited.statusCode).toBe(200);

    const res = await app.call('owner', 'POST', '/roles/preset', { preset: 'public' });

    expect(res.statusCode).toBe(200);
    const byKey = (key: string) =>
      res.json().items.find((role: { key: string }) => role.key === key);
    expect([...byKey('member').permissions].sort()).toEqual([...PUBLIC_MEMBER].sort());
    expect(byKey('dj').permissions).toContain('playback.control');
    expect(byKey('owner').permissions).toHaveLength(WATCH_PARTY_PERMISSION_IDS.length);
    expect(byKey('vip').memberCount).toBe(1);
    const custom = res.json().items.find((role: { id: string }) => role.id === customId);
    expect(custom.permissions).toEqual(['chat.pin']);
  });

  it.each([
    { who: 'member', code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING },
    { who: 'cohost', code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING },
  ] as const)('refuses $who applying one', async ({ who, code }) => {
    const app = await buildModerationApp();

    const res = await app.call(who, 'POST', '/roles/preset', { preset: 'public' });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(code);
  });
});

describe('live role changes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('revoking playback.control from Member bumps rolesVersion and publishes one roles frame', async () => {
    const app = await buildModerationApp();
    const before = (await app.roles()).rolesVersion;
    const frames = await app.collect();
    const member = (await app.roles()).items.find(({ key }) => key === 'member');

    const res = await app.call('owner', 'PATCH', `/roles/${app.ids.member}`, {
      permissions: (member?.permissions ?? []).filter(
        (permission) => permission !== 'playback.control'
      ),
      updatedAt: member?.updatedAt,
    });

    expect(res.statusCode).toBe(200);
    expect(frames.map(({ type }) => type)).toEqual(['chat.message', 'roles']);
    expect(frames[1]).toMatchObject({ type: 'roles', rolesVersion: before + 1 });
    expect(res.json().permissions).not.toContain('playback.control');
    expect((await app.roles()).rolesVersion).toBe(before + 1);
  });

  it('stops applying a 10-minute Chat muted at 10 minutes with no job having run', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date() });
    const app = await buildModerationApp();
    await app.give('member', 'chat_muted', '10m');
    const holders = async () =>
      (await app.roles()).items.find(({ key }) => key === 'chat_muted')?.memberCount;

    expect(await holders()).toBe(1);
    vi.advanceTimersByTime(10 * MINUTE_MS - 1);
    expect(await holders()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(await holders()).toBe(0);
    const rows = await app.repositories.watchPartyRoles.assignmentsOf(app.roomId, keyFor('member'));
    expect(expectOk(rows)).toHaveLength(1);
  });
});
