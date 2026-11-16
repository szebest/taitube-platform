import { SEEDED } from '@vp/testing';
import { createRng } from '../rng';
import { buildUsers, extraUserId } from '../world-users';

describe('seed/world-users: buildUsers', () => {
  const users = buildUsers(createRng(1), 12, 4);

  it('starts with the dev personas under the ids the client apps sign in as', () => {
    expect(users.slice(0, 4).map(({ kind, id, role }) => ({ kind, id, role }))).toEqual([
      { kind: 'creator', id: SEEDED.userId, role: 'CREATOR' },
      { kind: 'viewer', id: SEEDED.otherUserId, role: 'USER' },
      { kind: 'admin', id: '00000000-0000-7000-8000-00000000000a', role: 'ADMIN' },
      { kind: 'moderator', id: '00000000-0000-7000-8000-00000000000b', role: 'MODERATOR' },
    ]);
  });

  it('adds creators for the other channels, then fans, up to the user count', () => {
    expect(users).toHaveLength(12);
    expect(users.filter((user) => user.ownsChannel).map((user) => user.kind)).toEqual([
      'creator',
      'extra-creator',
      'extra-creator',
      'extra-creator',
    ]);
    expect(users.filter((user) => user.kind === 'fan')).toHaveLength(5);
  });

  it('gives every user a unique id, email and valid handle', () => {
    for (const field of ['id', 'email', 'handle'] as const) {
      expect(new Set(users.map((user) => user[field])).size).toBe(users.length);
    }
    expect(users.every((user) => /^[a-zA-Z0-9_.-]{3,30}$/.test(user.handle))).toBe(true);
    expect(users.every((user) => /^#[0-9a-f]{6}$/.test(user.brandColor))).toBe(true);
  });

  it('never has fewer users than the personas and the channel owners', () => {
    expect(buildUsers(createRng(1), 1, 6)).toHaveLength(9);
  });

  it('formats extra ids as UUIDs after the personas', () => {
    expect(extraUserId(1)).toBe('00000000-0000-7000-8000-000000001001');
    expect(extraUserId(26)).toBe('00000000-0000-7000-8000-00000000101a');
  });
});
