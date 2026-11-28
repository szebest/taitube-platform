import type { APIRequestContext } from '@playwright/test';
import { type Persona, type Stack, expect, test } from '../../../../../tests/playwright/fixtures';
import { CHANNEL_ATTEMPTS } from './channel-attempts';
import { ME_ATTEMPTS } from './me-attempts';
import {
  GUEST_REST_ROWS,
  LADDER_ROWS,
  ORGANIZER_ROWS,
  PARTY_ROUTE_ROWS,
  STAFF_ALLOWED,
  STAFF_REFUSED,
} from './party-attempts';
import {
  guestCredential,
  type PartyClients,
  type PartyRequest,
  type PartyWorld,
  seedParty,
} from './party-world';
import { TEAM_REFUSED } from './team-video-attempts';
import { TOKEN_ATTEMPTS } from './token-attempts';

const CALLERS = [
  { caller: 'a normal user', persona: 'viewer', status: 403, code: 'FORBIDDEN' },
  { caller: 'an anonymous caller', persona: undefined, status: 401, code: 'UNAUTHORIZED' },
] as const;

type Caller = (typeof CALLERS)[number]['caller'];

type Attempt = {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: (videoId: string, commentId: string, clipId: string) => string;
  data?: Record<string, unknown> | ((videoId: string) => Record<string, unknown>);
  target?: keyof Stack['videos'];
  /** A comment on the target video, written by a viewer first, for a route that addresses one. */
  onComment?: true;
  /** A clip on the target video, made by the creator first, for a route that addresses one. */
  onClip?: true;
  /** Every caller unless named; a `/me` route only ever addresses the caller's own account. */
  callers?: readonly Caller[];
};

const ATTEMPTS: Attempt[] = [
  {
    name: "edit another creator's video",
    method: 'PATCH',
    path: (id) => `/v1/videos/${id}`,
    data: { title: 'hijacked', version: 1 },
  },
  { name: "delete another creator's video", method: 'DELETE', path: (id) => `/v1/videos/${id}` },
  {
    name: "reprocess another creator's video",
    method: 'POST',
    path: (id) => `/v1/videos/${id}/reprocess`,
    data: {},
  },
  {
    name: "edit another creator's video in the studio",
    method: 'PATCH',
    path: (id) => `/v1/creator/videos/${id}`,
    data: { title: 'hijacked', version: 1 },
  },
  {
    name: "delete another creator's video in the studio",
    method: 'DELETE',
    path: (id) => `/v1/creator/videos/${id}`,
  },
  ...['analytics', 'audience', 'benchmark'].map((leaf): Attempt => ({
    name: `read another creator's video ${leaf}`,
    method: 'GET',
    path: (id) => `/v1/creator/videos/${id}/${leaf}`,
  })),
  {
    name: "read another creator's private video as an operator",
    method: 'GET',
    path: (id) => `/v1/admin/videos/${id}`,
    target: 'draft',
  },
  {
    name: "take another creator's video down",
    method: 'POST',
    path: (id) => `/v1/admin/videos/${id}/takedown`,
    data: { reason: 'hijacked' },
  },
  {
    name: "heart a comment on another creator's video",
    method: 'POST',
    path: (_, commentId) => `/v1/comments/${commentId}/heart`,
    onComment: true,
  },
  {
    name: "take the heart off a comment on another creator's video",
    method: 'DELETE',
    path: (_, commentId) => `/v1/comments/${commentId}/heart`,
    onComment: true,
  },
  {
    name: "delete another user's clip",
    method: 'DELETE',
    path: (_, __, clipId) => `/v1/clips/${clipId}`,
    target: 'clippable',
    onClip: true,
  },
  {
    name: 'clip a video',
    method: 'POST',
    path: (id) => `/v1/videos/${id}/clips`,
    data: { startMs: 0, endMs: 5000, title: 'refused' },
    target: 'clippable',
    callers: ['an anonymous caller'],
  },
  {
    name: 'list the own clips',
    method: 'GET',
    path: () => '/v1/me/clips',
    callers: ['an anonymous caller'],
  },
  {
    name: "pin another creator's video to the Start here shelf",
    method: 'PUT',
    path: () => '/v1/me/channel/featured',
    data: (id) => ({ videoIds: [id] }),
    target: 'watchable',
  },
  ...CHANNEL_ATTEMPTS,
  ...TOKEN_ATTEMPTS,
  { name: 'read the comment report queue', method: 'GET', path: () => '/v1/admin/reports' },
  {
    name: 'resolve a comment report',
    method: 'POST',
    path: () => '/v1/admin/reports/00000000-0000-7000-8000-000000000000/resolve',
    data: { resolution: 'removed' },
  },
  { name: 'list the dead letter queue', method: 'GET', path: () => '/v1/admin/dlq' },
  { name: 'list the scheduled picks', method: 'GET', path: () => '/v1/admin/picks' },
  {
    name: 'schedule a pick of the day',
    method: 'POST',
    path: () => '/v1/admin/picks',
    data: {
      videoId: '00000000-0000-7000-8000-000000000000',
      startsAt: '2099-01-01T00:00:00.000Z',
      endsAt: '2099-01-02T00:00:00.000Z',
      note: 'hijacked',
    },
  },
  {
    name: 'edit a pick of the day',
    method: 'PATCH',
    path: () => '/v1/admin/picks/00000000-0000-7000-8000-000000000000',
    data: { note: 'hijacked' },
  },
  {
    name: 'cancel a pick of the day',
    method: 'DELETE',
    path: () => '/v1/admin/picks/00000000-0000-7000-8000-000000000000',
  },
  {
    name: 'create a category',
    method: 'POST',
    path: () => '/v1/admin/categories',
    data: { name: 'Hijacked', slug: 'hijacked' },
  },
  ...ME_ATTEMPTS,
];

async function commentOn(viewer: APIRequestContext, videoId: string): Promise<string> {
  const created = await viewer.post(`/v1/videos/${videoId}/comments`, {
    data: { content: 'a comment to be refused' },
  });
  return (await created.json()).id;
}

async function clipBy(creator: APIRequestContext, videoId: string): Promise<string> {
  const created = await creator.post(`/v1/videos/${videoId}/clips`, {
    data: { startMs: 0, endMs: 5000, title: 'a clip to be refused' },
  });
  return (await created.json()).id;
}

async function send(
  client: APIRequestContext,
  { viewer, creator }: { viewer: APIRequestContext; creator: APIRequestContext },
  attempt: Attempt,
  stack: Stack
) {
  const video = stack.videos[attempt.target ?? 'watchable'];
  const commentId = attempt.onComment ? await commentOn(viewer, video.id) : '';
  const clipId = attempt.onClip ? await clipBy(creator, video.id) : '';
  return client.fetch(attempt.path(video.id, commentId, clipId), {
    method: attempt.method,
    data: typeof attempt.data === 'function' ? attempt.data(video.id) : attempt.data,
  });
}

test.describe('privilege escalation is refused with problem+json', () => {
  for (const { caller, persona, status, code } of CALLERS) {
    for (const attempt of ATTEMPTS.filter((row) => row.callers?.includes(caller) ?? true)) {
      test(`${caller} cannot ${attempt.name}`, async ({ api, stack }) => {
        const client = await api(persona);

        const others = { viewer: await api('viewer'), creator: await api('creator') };

        const response = await send(client, others, attempt, stack);

        expect(response.status()).toBe(status);
        expect(response.headers()['content-type']).toContain('application/problem+json');
        expect(await response.json()).toMatchObject({ status, code });
      });
    }
  }
});

test.describe('a channel team member is held to the role, with problem+json', () => {
  for (const { caller, persona, method, path, ...rest } of TEAM_REFUSED) {
    test(`${caller} of the channel cannot ${method === 'DELETE' ? 'delete' : 'edit'} its video on ${path}`, async ({
      api,
      stack,
    }) => {
      const { id, title } = stack.videos.watchable;
      const member = await api(persona, { channelId: stack.team.channelId });
      const owner = await api('creator');

      const response = await member.fetch(`${path}/${id}`, {
        method,
        data: 'data' in rest ? rest.data : undefined,
      });
      const kept = await owner.get(`/v1/videos/${id}`);

      expect(response.status()).toBe(403);
      expect(response.headers()['content-type']).toContain('application/problem+json');
      expect(await response.json()).toMatchObject({ status: 403, code: 'FORBIDDEN' });
      expect(kept.status()).toBe(200);
      expect((await kept.json()).title).toBe(title);
    });
  }
});

test.describe("another user's search history stays out of reach", () => {
  test('a viewer cannot read, remove or clear what a creator searched', async ({ api }) => {
    const creator = await api('creator');
    const viewer = await api('viewer');
    expect((await creator.get('/v1/search?q=hijack')).status()).toBe(200);
    const [entry] = (await (await creator.get('/v1/me/searches')).json()).items;

    const listed = await (await viewer.get('/v1/me/searches')).json();
    const removed = await viewer.delete(`/v1/me/searches/${entry.id}`);
    const cleared = await viewer.delete('/v1/me/searches');

    expect(listed.items).not.toContainEqual(expect.objectContaining({ id: entry.id }));
    expect(removed.status()).toBe(404);
    expect(await removed.json()).toMatchObject({ code: 'SEARCH_HISTORY_NOT_FOUND' });
    expect(cleared.status()).toBe(204);
    expect((await (await creator.get('/v1/me/searches')).json()).items).toContainEqual(
      expect.objectContaining({ id: entry.id })
    );
  });
});

test.describe("another user's recommendation feedback stays out of reach", () => {
  test('a viewer cannot remove what a creator marked, and does not see it', async ({
    api,
    stack,
  }) => {
    const creator = await api('creator');
    const viewer = await api('viewer');
    const marked = await creator.put('/v1/me/recommendation-feedback', {
      data: { kind: 'not_interested', videoId: stack.videos.watchable.id },
    });
    const { id } = await marked.json();

    const listed = await (await viewer.get('/v1/me/recommendation-feedback')).json();
    const removed = await viewer.delete(`/v1/me/recommendation-feedback/${id}`);

    expect(marked.status()).toBe(200);
    expect(listed.items).not.toContainEqual(expect.objectContaining({ id }));
    expect(removed.status()).toBe(404);
    expect(await removed.json()).toMatchObject({ code: 'RECOMMENDATION_FEEDBACK_NOT_FOUND' });
    expect(
      (await (await creator.get('/v1/me/recommendation-feedback')).json()).items
    ).toContainEqual(expect.objectContaining({ id }));
  });
});

type Api = (persona?: Persona | 'stranger' | 'platformModerator') => Promise<APIRequestContext>;

async function partyClients(api: Api): Promise<PartyClients> {
  return {
    creator: await api('creator'),
    seats: {
      organizer: await api('viewer'),
      moderator: await api('manager'),
      cohost: await api('editor'),
      dj: await api('analytics'),
      member: await api('recruiter'),
    },
    stranger: await api('stranger'),
    platformModerator: await api('platformModerator'),
    anonymous: await api(),
  };
}

async function inParty(
  api: Api,
  stack: Stack,
  attempt: (world: PartyWorld, clients: PartyClients) => Promise<void>
) {
  const clients = await partyClients(api);
  const world = await seedParty(clients, stack);
  try {
    await attempt(world, clients);
  } finally {
    await clients.creator.post(`/v1/watch-parties/${world.roomId}/close`, { data: {} });
  }
}

function fire(client: APIRequestContext, [method, path, data]: PartyRequest) {
  return client.fetch(path, { method, data });
}

async function expectRefused(
  response: Awaited<ReturnType<APIRequestContext['fetch']>>,
  status: number,
  code: string | null,
  name: string
) {
  expect(response.status(), name).toBe(status);
  expect(response.headers()['content-type'], name).toContain('application/problem+json');
  if (code !== null) expect(((await response.json()) as { code: string }).code, name).toBe(code);
}

test.describe('watch party actions are refused with problem+json', () => {
  test('a non-member and a plain member get 403 and a signed-out caller 401 on every host route', async ({
    api,
    stack,
  }) => {
    await inParty(api, stack, async (world, { stranger, seats, anonymous }) => {
      for (const row of PARTY_ROUTE_ROWS) {
        const request = row.request(world);
        for (const [client, who] of [
          [stranger, 'a non-member'],
          [seats.member, 'a plain member'],
        ] as const) {
          await expectRefused(await fire(client, request), 403, null, `${who} cannot ${row.name}`);
        }
        await expectRefused(
          await fire(anonymous, request),
          401,
          'UNAUTHORIZED',
          `a signed-out caller cannot ${row.name}`
        );
      }
    });
  });

  test('an Organizer at position 450 cannot escalate', async ({ api, stack }) => {
    await inParty(api, stack, async (world, { seats }) => {
      for (const row of ORGANIZER_ROWS) {
        await expectRefused(
          await fire(seats.organizer, row.request(world)),
          403,
          row.code,
          `an Organizer cannot do ${row.name}`
        );
      }
    });
  });

  test('an Organizer cannot lift their own Chat muted', async ({ api, stack }) => {
    await inParty(api, stack, async (world, { creator, seats }) => {
      const base = `/v1/watch-parties/${world.roomId}/members/${world.key.organizer}/roles`;
      await creator.put(`${base}/${world.role.chat_muted}`, { data: {} });

      await expectRefused(
        await seats.organizer.delete(`${base}/${world.role.chat_muted}`),
        403,
        'WATCH_PARTY_ROLE_ESCALATION',
        'an Organizer lifting their own Chat muted'
      );
    });
  });

  test('the built-in ladder holds', async ({ api, stack }) => {
    await inParty(api, stack, async (world, { seats }) => {
      for (const row of LADDER_ROWS) {
        await expectRefused(
          await fire(seats[row.seat], row.request(world)),
          403,
          row.code,
          row.name
        );
      }
    });
  });

  test('a platform MODERATOR without a seat acts on members and the room but never on roles', async ({
    api,
    stack,
  }) => {
    await inParty(api, stack, async (world, { platformModerator }) => {
      for (const row of STAFF_REFUSED) {
        await expectRefused(
          await fire(platformModerator, row.request(world)),
          403,
          null,
          `a platform MODERATOR cannot ${row.name}`
        );
      }
      for (const row of STAFF_ALLOWED) {
        const response = await fire(platformModerator, row.request(world));
        expect(response.ok(), `a platform MODERATOR can ${row.name}`).toBe(true);
      }
    });
  });

  test('a guest credential reaches no member action and no account route', async ({
    api,
    stack,
  }) => {
    await inParty(api, stack, async (world, { anonymous }) => {
      const headers = await guestCredential(anonymous, world.roomId);
      const guest = await api();

      for (const row of GUEST_REST_ROWS) {
        const [method, path, data] = row.request(world);
        const response = await guest.fetch(path, { method, data, headers });
        await expectRefused(response, row.status, null, `a guest cannot ${row.name}`);
      }
    });
  });

  test('a guest on the room socket is refused every chat, reaction, playback and request frame', async ({
    api,
    stack,
  }) => {
    await inParty(api, stack, async (world, { anonymous }) => {
      const headers = await guestCredential(anonymous, world.roomId);
      const guest = await api();
      const ticket = (
        await (
          await guest.post(`/v1/watch-parties/${world.roomId}/socket-ticket`, { headers })
        ).json()
      ).ticket;

      const refusals = await guestRefusals(stack.apiUrl, world.roomId, ticket);

      expect(refusals).toEqual(
        new Array(GUEST_FRAMES.length + 1).fill('WATCH_PARTY_PERMISSION_MISSING')
      );
    });
  });
});

const GUEST_FRAMES = [
  { type: 'chat.send', ref: 'c1', message: 'hello' },
  { type: 'react', emoji: '🔥' },
  { type: 'request', kind: 'skip' },
] as const;

function guestRefusals(apiUrl: string, roomId: string, ticket: string): Promise<string[]> {
  const socket = new WebSocket(
    `${apiUrl.replace(/^http/, 'ws')}/v1/watch-parties/${roomId}/socket?ticket=${ticket}`
  );
  const codes: string[] = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the socket did not answer in time')), 10_000);
    socket.addEventListener('message', ({ data }) => {
      const frame = JSON.parse(String(data));
      if (frame.type === 'hello') {
        for (const sent of GUEST_FRAMES) socket.send(JSON.stringify(sent));
        socket.send(
          JSON.stringify({
            type: 'pause',
            ref: 'p1',
            version: frame.version,
            rolesVersion: frame.rolesVersion,
            positionMs: 0,
          })
        );
      }
      if (frame.type === 'error') codes.push(frame.problem.code);
      if (codes.length === GUEST_FRAMES.length + 1) {
        clearTimeout(timer);
        socket.close();
        resolve(codes);
      }
    });
    socket.addEventListener('error', () => reject(new Error('the room socket did not open')));
  });
}
