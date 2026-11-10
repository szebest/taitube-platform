import { mintToken } from '@vp/dev-token';
import type { BuiltInRoleKey, WatchPartyPreset } from '@vp/domain';
import { watchPartyChannel } from '@vp/events';
import type { UserContext } from '@vp/permissions';
import type { LightMyRequestResponse } from 'fastify';
import {
  GUEST_KEY,
  keyOf,
  ROOM_ID,
  roleIdsOf,
  seatGuest,
  seatUser,
  seedRoom,
} from '../services/watch-party/__tests__/watch-party-moderation-fixture';
import {
  MEMBER,
  MODERATOR,
  OTHER,
  OWNER,
} from '../services/watch-party/__tests__/watch-party-test-deps';
import { bearer, buildTestApp } from './test-app';

const user = (tail: string): UserContext => ({
  id: `00000000-0000-7000-8000-00000000f${tail}`,
  role: 'USER',
});

export const PEOPLE = {
  owner: OWNER,
  member: MEMBER,
  other: OTHER,
  platformModerator: MODERATOR,
  organizer: user('010'),
  moderator: user('011'),
  cohost: user('012'),
  dj: user('013'),
  stranger: user('0aa'),
} as const;

export type Who = keyof typeof PEOPLE | 'anonymous';
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export const STALE = '2020-01-01T00:00:00.000Z';
export const ABSENT_KEY = 'user:00000000-0000-7000-8000-00000000f0ff';
export const ORGANIZER_PERMISSIONS = ['roles.manage', 'roles.assign', 'chat.moderate'];

const SEATED: readonly (keyof typeof PEOPLE)[] = [
  'member',
  'other',
  'organizer',
  'moderator',
  'cohost',
  'dj',
] as const;

const tokenOf = ({ id, role }: UserContext) =>
  mintToken({ sub: id, role: role.toLowerCase(), ttl: '1h' });

export const keyFor = (who: keyof typeof PEOPLE) => keyOf(PEOPLE[who]);

export interface ModerationApp extends Awaited<ReturnType<typeof buildTestApp>> {
  roomId: string;
  guestKey: string;
  ids: Record<BuiltInRoleKey, string>;
  call(
    who: Who,
    method: Method,
    path: string,
    payload?: Record<string, unknown>
  ): Promise<LightMyRequestResponse>;
  give(who: keyof typeof PEOPLE, role: BuiltInRoleKey, expiresIn?: string): Promise<void>;
  roles(): Promise<{
    items: {
      id: string;
      key: string | null;
      name: string;
      colour: string | null;
      position: number;
      permissions: string[];
      memberCount: number;
      updatedAt: string;
    }[];
    rolesVersion: number;
  }>;
  collect(): Promise<{ type: string }[]>;
}

export async function buildModerationApp(preset: WatchPartyPreset = 'friends') {
  const testApp = await buildTestApp();
  const { app, repositories, cache } = testApp;
  const at = new Date();
  await seedRoom(repositories, OWNER, at, preset);
  for (const who of SEATED) await seatUser(repositories, PEOPLE[who], at);
  await seatGuest(repositories, at);

  const call: ModerationApp['call'] = (who, method, path, payload) =>
    app.inject({
      method,
      url: `/v1/watch-parties/${ROOM_ID}${path}`,
      headers: who === 'anonymous' ? {} : bearer(tokenOf(PEOPLE[who])),
      ...(payload === undefined ? {} : { payload }),
    });

  const modApp: ModerationApp = {
    ...testApp,
    roomId: ROOM_ID,
    guestKey: GUEST_KEY,
    ids: await roleIdsOf(repositories, at),
    call,
    async give(who, role, expiresIn) {
      const res = await call(
        'owner',
        'PUT',
        `/members/${keyFor(who)}/roles/${modApp.ids[role]}`,
        expiresIn === undefined ? {} : { expiresIn }
      );
      if (res.statusCode !== 204) throw new Error(`giving ${role} to ${who}: ${res.body}`);
    },
    async roles() {
      return (await call('owner', 'GET', '/roles')).json();
    },
    async collect() {
      const received: { type: string }[] = [];
      await cache.subscribe(watchPartyChannel(ROOM_ID), (_channel, message) => {
        received.push(JSON.parse(message).frame);
      });
      return received;
    },
  };
  await modApp.give('moderator', 'moderator');
  await modApp.give('cohost', 'cohost');
  await modApp.give('dj', 'dj');
  return modApp;
}
