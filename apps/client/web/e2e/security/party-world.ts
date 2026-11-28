import type { APIRequestContext } from '@playwright/test';
import { PARTY_GUEST_COOKIE } from '@vp/api-contracts';
import type { Stack } from '../../../../../tests/playwright/fixtures';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type PartyRequest = readonly [Method, string, Record<string, unknown>?];

export const STALE = '2020-01-01T00:00:00.000Z';
export const ORGANIZER_PERMISSIONS = ['roles.manage', 'roles.assign', 'chat.moderate'];

const BUILT_INS = [
  'owner',
  'cohost',
  'moderator',
  'chat_muted',
  'dj',
  'vip',
  'member',
  'guest',
] as const;

type BuiltIn = (typeof BUILT_INS)[number];

export type Seat = 'organizer' | 'moderator' | 'cohost' | 'dj' | 'member';

export interface PartyClients {
  readonly creator: APIRequestContext;
  readonly seats: Record<Seat, APIRequestContext>;
  readonly stranger: APIRequestContext;
  readonly platformModerator: APIRequestContext;
  readonly anonymous: APIRequestContext;
}

/** A room as the attempts address it: its ids, the member keys of each seat and what the tables point at. */
export interface PartyWorld {
  readonly roomId: string;
  readonly role: Record<BuiltIn, string>;
  readonly organizerRoleId: string;
  readonly lowerRoleId: string;
  readonly queueItemId: string;
  readonly videoId: string;
  readonly key: Record<Seat | 'creator', string>;
}

const SEAT_ROLES: Record<Exclude<Seat, 'organizer' | 'member'>, BuiltIn> = {
  moderator: 'moderator',
  cohost: 'cohost',
  dj: 'dj',
};

async function keyOf(client: APIRequestContext): Promise<string> {
  const account = await json<{ user: { id: string } }>(await client.get('/v1/me/account'));
  return `user:${account.user.id}`;
}

async function json<T = { id: string }>(
  response: Awaited<ReturnType<APIRequestContext['get']>>
): Promise<T> {
  if (!response.ok()) throw new Error(`${response.url()} answered ${response.status()}`);
  return (await response.json()) as T;
}

/**
 * An unlisted room of the creator's with a member in every seat the escalation tables need:
 * Organizer (a custom role at 450 holding roles.manage, roles.assign and chat.moderate), Moderator,
 * Co-host, DJ and a plain Member, and one queued video.
 */
export async function seedParty(clients: PartyClients, stack: Stack): Promise<PartyWorld> {
  const { creator, seats } = clients;
  const room = await json(
    await creator.post('/v1/watch-parties', {
      data: { visibility: 'unlisted', preset: 'friends', hostAs: 'user', allowGuests: true },
    })
  );
  const roomId: string = room.id;
  const base = `/v1/watch-parties/${roomId}`;
  for (const client of Object.values(seats)) await json(await client.post(`${base}/join`));

  const listed = await json<{ items: { key: string; id: string }[] }>(
    await creator.get(`${base}/roles`)
  );
  const role = Object.fromEntries(
    BUILT_INS.map((key) => [key, listed.items.find((item) => item.key === key)?.id])
  ) as Record<BuiltIn, string>;
  const organizer = await json(
    await creator.post(`${base}/roles`, {
      data: { name: 'Organizer', position: 450, permissions: ORGANIZER_PERMISSIONS },
    })
  );
  const lower = await json(
    await creator.post(`${base}/roles`, {
      data: { name: 'Lower', position: 350, permissions: ['chat.pin'] },
    })
  );
  const key = {
    creator: await keyOf(creator),
    organizer: await keyOf(seats.organizer),
    moderator: await keyOf(seats.moderator),
    cohost: await keyOf(seats.cohost),
    dj: await keyOf(seats.dj),
    member: await keyOf(seats.member),
  };
  const assign = (memberKey: string, roleId: string) =>
    creator.put(`${base}/members/${memberKey}/roles/${roleId}`, { data: {} }).then(json);
  await assign(key.organizer, organizer.id);
  for (const [seat, builtIn] of Object.entries(SEAT_ROLES)) {
    await assign(key[seat as keyof typeof SEAT_ROLES], role[builtIn]);
  }
  const queued = await json<{ items: { id: string }[] }>(
    await creator.post(`${base}/queue`, { data: { videoId: stack.videos.watchable.id } })
  );
  return {
    roomId,
    role,
    organizerRoleId: organizer.id,
    lowerRoleId: lower.id,
    queueItemId: queued.items[0]?.id ?? '',
    videoId: stack.videos.watchable.id,
    key,
  };
}

/** The party credential a guest holds after joining, as the header it travels in. */
export async function guestCredential(anonymous: APIRequestContext, roomId: string) {
  const joined = await anonymous.post(`/v1/watch-parties/${roomId}/guest`, { data: {} });
  if (joined.status() !== 201) throw new Error(`guest join answered ${joined.status()}`);
  const cookie = joined
    .headersArray()
    .filter(({ name }) => name.toLowerCase() === 'set-cookie')
    .map(({ value }) => value)
    .find((value) => value.startsWith(`${PARTY_GUEST_COOKIE}=`));
  const credential = cookie?.slice(PARTY_GUEST_COOKIE.length + 1).split(';')[0];
  if (!credential) throw new Error('the guest join set no credential');
  return { 'x-party-credential': credential };
}
