import {
  InMemoryCacheClient,
  InMemoryLiveChatGate,
  type InMemoryRepositories,
} from '@vp/adapters/in-memory';
import type { LiveChatServerFrame } from '@vp/api-contracts';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { createLogger } from '@vp/logger';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { LiveChatHub } from '../live-chat-hub';
import { type LiveChatSession, LiveChatService } from '../live-chat-service';
import { liveWorld, MODERATOR, OWNER, STARTED, STREAM_ID, VIEWER } from './live-harness';

const ORIGIN = 'http://localhost:5173';
const TUNING = inProcessAppConfig().live.chat;

describe('apps/server/api/services: LiveChatService', () => {
  let repositories: InMemoryRepositories;
  let gate: InMemoryLiveChatGate;
  let service: LiveChatService;
  let clock: number;

  async function setUp(world: Parameters<typeof liveWorld>[0] = {}) {
    ({ repositories } = await liveWorld(world));
    clock = STARTED.getTime() + 5_000;
    gate = new InMemoryLiveChatGate(() => clock);
    const cache = new InMemoryCacheClient();
    let tickets = 0;
    service = new LiveChatService({
      liveStreams: repositories.liveStreams,
      channels: repositories.channels,
      videos: repositories.videos,
      liveChat: repositories.liveChat,
      subscriptions: repositories.subscriptions,
      gate,
      hub: new LiveChatHub({
        cache,
        logger: createLogger({ format: 'json', service: 'chat-spec', level: 'silent' }),
      }),
      cache,
      allowedOrigins: [ORIGIN],
      tuning: TUNING,
      newTicket: () => `ticket-${++tickets}`,
      now: () => clock,
    });
  }

  async function sessionOf(user: UserContext | null): Promise<LiveChatSession> {
    if (user === null) return expectOk(await service.open({ liveStreamId: STREAM_ID }));
    const { ticket } = expectOk(await service.issueTicket(user, STREAM_ID));
    return expectOk(await service.open({ liveStreamId: STREAM_ID, ticket, origin: ORIGIN }));
  }

  async function connect(user: UserContext | null, after: string | null = null) {
    const frames: LiveChatServerFrame[] = [];
    const connection = expectOk(
      await service.connect(await sessionOf(user), after, (frame) => frames.push(frame))
    );
    const send = async (frame: object) => (await connection.receive(JSON.stringify(frame))).result;
    return { frames, connection, send };
  }

  const say = async (user: UserContext, message: string) =>
    expectOk(await (await connect(user)).send({ type: 'send', ref: 'r', message }));

  beforeEach(async () => {
    await setUp();
  });

  it('greets a ticketed viewer, sends the backlog, then every line any socket sends, once', async () => {
    await say(VIEWER, 'first');
    const watcher = await connect(VIEWER);

    const ack = expectOk(
      await watcher.send({ type: 'send', ref: 'r1', message: ' hello\nthere ' })
    );

    expect(ack).toEqual({ type: 'ack', ref: 'r1', id: expect.any(String) });
    expect(watcher.frames).toEqual([
      {
        type: 'hello',
        resume: 'fresh',
        mode: { slowModeSeconds: 0, subscribersOnly: false },
        canSend: true,
        canModerate: false,
      },
      { type: 'message', message: expect.objectContaining({ message: 'first' }) },
      {
        type: 'message',
        message: expect.objectContaining({ message: 'hello there', offsetMs: 5_000 }),
      },
    ]);
  });

  it('stores the line before it fans out, so a reconnect replays what it missed', async () => {
    const first = await say(VIEWER, 'one');
    await say(VIEWER, 'two');

    const resumed = await connect(null, first.type === 'ack' ? first.id : null);

    expect(resumed.frames.map((frame) => frame.type)).toEqual(['hello', 'message']);
    expect(resumed.frames[0]).toMatchObject({ resume: 'replayed', canSend: false });
  });

  it.each([
    {
      scenario: 'a spent ticket',
      input: { ticket: 'ticket-1' },
      code: ErrorCodes.LIVE_CHAT_TICKET_INVALID,
    },
    {
      scenario: 'an unknown ticket',
      input: { ticket: 'nope' },
      code: ErrorCodes.LIVE_CHAT_TICKET_INVALID,
    },
    {
      scenario: 'a foreign origin',
      input: { origin: 'https://evil.test' },
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses to open a socket with $scenario', async ({ input, code }) => {
    await sessionOf(VIEWER);

    expect(expectErr(await service.open({ liveStreamId: STREAM_ID, ...input })).code).toBe(code);
  });

  it.each([
    { scenario: 'an idle stream', world: { live: false }, code: ErrorCodes.LIVE_STREAM_NOT_FOUND },
    {
      scenario: 'a private one',
      world: { visibility: 'private' as const },
      code: ErrorCodes.UNAUTHORIZED,
    },
  ])('refuses a socket on $scenario', async ({ world, code }) => {
    await setUp(world);

    expect(expectErr(await service.open({ liveStreamId: STREAM_ID })).code).toBe(code);
  });

  it.each([
    {
      scenario: 'a socket with no ticket',
      user: null,
      frame: { message: 'hi' },
      code: ErrorCodes.LIVE_CHAT_TICKET_INVALID,
    },
    {
      scenario: 'an empty line',
      user: VIEWER,
      frame: { message: '  ' },
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses a line from $scenario', async ({ user, frame, code }) => {
    const { send } = await connect(user);

    expect(expectErr(await send({ type: 'send', ...frame })).code).toBe(code);
  });

  it('refuses a frame it cannot read', async () => {
    const { connection } = await connect(VIEWER);

    expect(expectErr((await connection.receive('{not json')).result).code).toBe(
      ErrorCodes.VALIDATION_FAILED
    );
  });

  it('holds a viewer to slow mode and subscribers-only, and lets the owner past both', async () => {
    expectOk(
      await repositories.liveStreams.update(STREAM_ID, {
        chatSlowModeSeconds: 30,
        chatSubscribersOnly: true,
      })
    );
    const viewer = await connect(VIEWER);
    const owner = await connect(OWNER);

    expect(expectErr(await viewer.send({ type: 'send', message: 'hi' })).code).toBe(
      ErrorCodes.LIVE_CHAT_SUBSCRIBERS_ONLY
    );
    const channel = expectOk(await repositories.channels.findByUserId(OWNER.id));
    expectOk(await repositories.subscriptions.subscribe(VIEWER.id, channel?.id ?? ''));
    expectOk(await viewer.send({ type: 'send', message: 'hi' }));
    expect(expectErr(await viewer.send({ type: 'send', message: 'again' }))).toMatchObject({
      code: ErrorCodes.LIVE_CHAT_SLOW_MODE,
      retryAfterSeconds: 30,
    });
    for (const line of ['a', 'b']) expectOk(await owner.send({ type: 'send', message: line }));
  });

  it('closes the chat once the stream ended', async () => {
    const viewer = await connect(VIEWER);
    expectOk(
      await repositories.liveStreams.end({
        streamId: STREAM_ID,
        endedAt: new Date(clock),
        nextId: '00000000-0000-7000-8000-00000000f102',
      })
    );

    expect(expectErr(await viewer.send({ type: 'send', message: 'hi' })).code).toBe(
      ErrorCodes.LIVE_CHAT_CLOSED
    );
  });

  it('lets a moderator remove a line for everyone, and refuses a viewer', async () => {
    const said = await say(VIEWER, 'spam');
    const id = said.type === 'ack' ? said.id : '';
    const viewer = await connect(VIEWER);
    const moderator = await connect(MODERATOR);

    expect(expectErr(await viewer.send({ type: 'remove', id })).code).toBe(ErrorCodes.FORBIDDEN);
    expect(expectOk(await moderator.send({ type: 'remove', id }))).toMatchObject({
      type: 'ack',
      id,
    });
    expect(viewer.frames.at(-1)).toEqual({ type: 'removed', id });
    expect((await connect(null)).frames.map((frame) => frame.type)).toEqual(['hello']);
  });
});
