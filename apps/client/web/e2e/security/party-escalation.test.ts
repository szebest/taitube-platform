import type { APIRequestContext } from '@playwright/test';
import { type Persona, type Stack, expect, test } from '../../../../../tests/playwright/fixtures';
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
        socket.close();
        resolve(codes);
      }
    });
    socket.addEventListener('error', () => reject(new Error('the room socket did not open')));
  });
}
