import type { WatchPartyServerFrame } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { dial, type SocketClient } from './socket-client';
import { buildWatchPartyApp, type WatchPartyApp, type Who } from './watch-party-app';

type Frame = WatchPartyServerFrame;
type Hello = Extract<Frame, { type: 'hello' }>;

const OWNER_KEY = `user:${SEEDED.userId}`;
const MEMBER_KEY = `user:${SEEDED.otherUserId}`;

interface Pod {
  world: WatchPartyApp;
  address: string;
}

/** Frames one socket heard, read in order: each wait starts after the frame the last one found. */
function reader(client: SocketClient<Frame>) {
  let seen = 0;
  return async <T extends Frame['type']>(
    type: T,
    matches: (frame: Extract<Frame, { type: T }>) => boolean = () => true
  ): Promise<Extract<Frame, { type: T }>> => {
    for (;;) {
      seen += 1;
      const frame = (await client.next(seen))[seen - 1];
      if (frame?.type === type && matches(frame as Extract<Frame, { type: T }>)) {
        return frame as Extract<Frame, { type: T }>;
      }
    }
  };
}

describe('the room socket', () => {
  let a: Pod;
  let b: Pod;
  let roomId: string;
  const open: SocketClient<Frame>[] = [];

  beforeEach(async () => {
    const first = await buildWatchPartyApp();
    const second = await buildWatchPartyApp({}, first);
    a = { world: first, address: await first.app.listen({ host: '127.0.0.1', port: 0 }) };
    b = { world: second, address: await second.app.listen({ host: '127.0.0.1', port: 0 }) };
    ({ id: roomId } = await a.world.createRoom());
    await a.world.call('other', 'POST', `/v1/watch-parties/${roomId}/join`);
  });

  afterEach(async () => {
    await Promise.all(open.splice(0).map((client) => client.close()));
    await Promise.all([a.world.app.close(), b.world.app.close()]);
  });

  async function ticket(pod: Pod, who: Who): Promise<string> {
    const res = await pod.world.call(who, 'POST', `/v1/watch-parties/${roomId}/socket-ticket`);
    expect(res.statusCode).toBe(201);
    return res.json().ticket;
  }

  async function connect(pod: Pod, who: Who, after?: string) {
    const query = `?ticket=${await ticket(pod, who)}${after ? `&after=${after}` : ''}`;
    const client = await dial<Frame>(pod.address, `/v1/watch-parties/${roomId}/socket${query}`);
    open.push(client);
    const next = reader(client);
    const hello: Hello = await next('hello');
    const send = (frame: Record<string, unknown>) => client.socket.send(JSON.stringify(frame));
    return { client, next, hello, send };
  }

  it('carries a command from one pod to a member on another, and refuses an old version as stale', async () => {
    const owner = await connect(a, 'owner');
    const member = await connect(b, 'other');
    const { version, rolesVersion } = owner.hello;

    owner.send({ type: 'start', ref: 's1', version, rolesVersion });
    const heard = await member.next('state');
    const countdown = await member.next('countdown');
    const acked = await owner.next('ack');
    member.send({ type: 'pause', ref: 'p1', version, rolesVersion, positionMs: 2_000 });
    const current = await member.next('state');
    const refused = await member.next('error');

    expect(heard).toMatchObject({ version: version + 1, by: OWNER_KEY, reason: 'command' });
    expect(heard.playback.phase).toBe('playing');
    expect(countdown.startsAt).toBe(heard.playback.anchorAt);
    expect(acked.ref).toBe('s1');
    expect(current.version).toBe(version + 1);
    expect(refused).toMatchObject({
      ref: 'p1',
      problem: { code: ErrorCodes.WATCH_PARTY_STATE_STALE, status: 409 },
    });
  });

  it('opens with the room, the caller and the clock, and answers a clock ping', async () => {
    const member = await connect(b, 'other');

    member.send({ type: 'clock', t0: 42 });
    const clock = await member.next('clock');

    expect(member.hello).toMatchObject({
      room: { id: roomId },
      you: { memberKey: MEMBER_KEY, kind: 'user' },
      playback: { phase: 'lobby' },
      chat: { resume: 'fresh', mode: { enabled: true } },
    });
    expect(member.hello.roster.entries.map(({ memberKey }) => memberKey).sort()).toEqual(
      [OWNER_KEY, MEMBER_KEY].sort()
    );
    expect(clock).toMatchObject({ t0: 42, serverNow: expect.any(Number) });
  });

  it('supersedes a member’s socket on one pod when they open another on the other pod', async () => {
    const first = await connect(a, 'other');
    const closed = new Promise((resolve) => first.client.socket.addEventListener('close', resolve));

    await connect(b, 'other');

    expect(await first.next('superseded')).toEqual({ type: 'superseded' });
    await closed;
  });

  it('stores a line before publishing it, and replays only what a reconnect missed', async () => {
    const owner = await connect(a, 'owner');
    const member = await connect(b, 'other');

    owner.send({ type: 'chat.send', ref: 'c1', message: 'one' });
    const first = await member.next('chat.message', ({ message }) => message.kind === 'text');
    await member.client.close();
    owner.send({ type: 'chat.send', ref: 'c2', message: 'two' });
    await owner.next('ack');
    await owner.next('ack');
    const back = await connect(b, 'other', first.message.id);
    const replayed = await back.next('chat.message', ({ message }) => message.kind === 'text');

    expect(first.message).toMatchObject({ body: 'one', author: { memberKey: OWNER_KEY } });
    expect(back.hello.chat.resume).toBe('replayed');
    expect(replayed.message.body).toBe('two');
  });

  it('folds a burst of reactions into one frame per pod', async () => {
    const owner = await connect(a, 'owner');
    const member = await connect(a, 'other');

    for (const emoji of ['🔥', '🔥', '🎉']) member.send({ type: 'react', emoji });
    const folded = await owner.next('reactions');

    expect(folded).toEqual({
      type: 'reactions',
      counts: { '🔥': 2, '🎉': 1 },
      from: [
        { memberKey: MEMBER_KEY, emoji: '🔥', count: 2 },
        { memberKey: MEMBER_KEY, emoji: '🎉', count: 1 },
      ],
    });
  });

  it('tells every socket who arrived in one batched roster patch', async () => {
    const owner = await connect(a, 'owner');

    await connect(b, 'other');
    const patch = await owner.next('roster.patch', ({ upserts }) =>
      upserts.some(({ memberKey }) => memberKey === MEMBER_KEY)
    );

    expect(patch).toMatchObject({ removals: [], guests: 0 });
  });

  it('answers an unknown frame type with an error frame and stays open', async () => {
    const member = await connect(a, 'other');

    member.send({ type: 'dance' });
    const refused = await member.next('error');
    member.send({ type: 'clock', t0: 1 });

    expect(refused.problem.code).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(await member.next('clock')).toMatchObject({ t0: 1 });
  });

  it.each([
    { scenario: 'a spent ticket', query: '?ticket=spent', headers: {}, status: 401 },
    {
      scenario: 'a foreign origin',
      query: '?ticket=spent',
      headers: { origin: 'https://evil.test' },
      status: 403,
    },
  ])('refuses the upgrade for $scenario with $status', async ({ query, headers, status }) => {
    const res = await a.world.app.inject({
      method: 'GET',
      url: `/v1/watch-parties/${roomId}/socket${query}`,
      headers,
    });

    expect([res.statusCode, res.json().status]).toEqual([status, status]);
  });

  it('refuses a one-time token issued for another room', async () => {
    const { id: elsewhere } = await a.world.createRoom();
    const spent = await ticket(a, 'owner');

    const res = await a.world.app.inject({
      method: 'GET',
      url: `/v1/watch-parties/${elsewhere}/socket?ticket=${spent}`,
    });

    expect([res.statusCode, res.json().code]).toEqual([401, ErrorCodes.WATCH_PARTY_TICKET_INVALID]);
  });
});
