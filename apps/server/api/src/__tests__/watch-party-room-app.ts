import { mintToken } from '@vp/dev-token';
import type { WatchPartyPermission, WatchPartyVisibility } from '@vp/domain';
import { DEFAULT_PREFERENCES, type NotificationPreferences } from '@vp/domain/settings';
import { NOTIFY_PARTY_INVITE } from '@vp/job-contracts';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import type { LightMyRequestResponse } from 'fastify';
import { uuidv7 } from 'uuidv7';
import {
  keyOf,
  ROOM_ID,
  seatUser,
  seedRoom,
} from '../services/watch-party/__tests__/watch-party-moderation-fixture';
import { type TestApp, bearer, buildTestApp, seedVideo } from './test-app';

export { ROOM_ID };

const accountId = (n: number) => `018f0000-0000-7000-8000-0000000b${String(n).padStart(4, '0')}`;
export const videoId = (n: number) =>
  `018f0000-0000-7000-8000-0000000c${String(n).padStart(4, '0')}`;

export interface Account {
  readonly user: UserContext;
  readonly key: string;
  readonly headers: { authorization: string };
}

type VideoOverrides = Omit<Partial<Parameters<typeof seedVideo>[1]>, 'id'>;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RoomApp extends TestApp {
  readonly owner: Account;
  readonly member: Account;
  /** An account with a channel, so it can be named, searched and invited. */
  account(n: number): Promise<Account>;
  /** Takes a seat in the room for an account that has none. */
  seat(account: Account): Promise<void>;
  /** What the built-in Member role may do from now on, whoever holds it. */
  memberMayOnly(...permissions: WatchPartyPermission[]): Promise<void>;
  call(
    who: Account | null,
    method: Method,
    url: string,
    payload?: Record<string, unknown>
  ): Promise<LightMyRequestResponse>;
  video(n: number, overrides?: VideoOverrides): Promise<string>;
  roomIs(visibility: WatchPartyVisibility): Promise<void>;
  /** The account's saved notification settings, with these over the defaults. */
  prefers(account: Account, notifications: Partial<NotificationPreferences>): Promise<void>;
  /** The `notify-party-invite` jobs waiting in the outbox, by job id. */
  inviteJobIds(): Promise<string[]>;
  closeRoom(): Promise<void>;
}

/**
 * A friends room holding an owner (account 1) and a member (account 2), and an app over the same
 * stores. Every account made through `account` owns a channel, as the auth hook gives one on the
 * first request.
 */
export async function buildRoomApp(): Promise<RoomApp> {
  const testApp = await buildTestApp();
  const { app, repositories } = testApp;
  const at = new Date();

  const account: RoomApp['account'] = async (n) => {
    const id = accountId(n);
    expectOk(await repositories.users.upsert({ id, email: `account${n}@taitube.local` }));
    expectOk(
      await repositories.channels.create({
        userId: id,
        handle: `account-${n}`,
        displayName: `Account ${n}`,
      })
    );
    const user: UserContext = { id, role: 'USER' };
    return {
      user,
      key: keyOf(user),
      headers: bearer(mintToken({ sub: id, role: 'USER', ttl: '1h' })),
    };
  };

  const owner = await account(1);
  const member = await account(2);
  await seedRoom(repositories, owner.user, at);
  await seatUser(repositories, member.user, at);

  return {
    ...testApp,
    owner,
    member,
    account,
    seat: (who) => seatUser(repositories, who.user, at),
    memberMayOnly: async (...permissions) => {
      const change = {
        line: {
          id: uuidv7(),
          line: { event: 'roles_changed' as const, actorKey: null, targetKey: null, detail: null },
          videoId: null,
          positionMs: null,
          createdAt: at,
        },
        at,
      };
      expectOk(
        await repositories.watchPartyRoles.resetBuiltIns(
          ROOM_ID,
          [{ key: 'member', permissions }],
          change
        )
      );
    },
    roomIs: async (visibility) => {
      const room = expectOk(await repositories.watchPartyRooms.findById(ROOM_ID));
      if (room === null) throw new Error('the room is gone');
      expectOk(
        await repositories.watchPartyRooms.updateSettings(
          ROOM_ID,
          { visibility },
          room.version,
          null,
          at
        )
      );
    },
    prefers: async ({ user }, notifications) => {
      expectOk(
        await repositories.userPreferences.save({
          userId: user.id,
          preferences: {
            appearance: null,
            playback: null,
            privacy: null,
            notifications: { ...DEFAULT_PREFERENCES.notifications, ...notifications },
          },
          expectedVersion: 0,
          sections: ['notifications'],
        })
      );
    },
    inviteJobIds: async () =>
      expectOk(await repositories.outbox.claimBatch(100)).flatMap(({ payload }) =>
        payload.type === 'queue' && payload.job.name === NOTIFY_PARTY_INVITE
          ? [payload.job.opts?.jobId ?? '']
          : []
      ),
    closeRoom: async () => {
      expectOk(await repositories.watchPartyRooms.close(ROOM_ID, 'owner', null, at));
    },
    call: (who, method, url, payload) =>
      app.inject({ method, url, headers: who?.headers ?? {}, ...(payload ? { payload } : {}) }),
    video: async (n, overrides = {}) => {
      const id = videoId(n);
      await seedVideo(repositories, {
        id,
        ownerId: owner.user.id,
        title: `Video ${n}`,
        ...overrides,
      });
      return id;
    },
  };
}
