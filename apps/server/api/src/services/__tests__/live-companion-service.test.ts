import {
  InMemoryCacheClient,
  InMemoryLiveGateway,
  type InMemoryRepositories,
} from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { LiveCompanionService } from '../live-companion-service';
import { liveWorld, STARTED, STREAM_ID } from './live-harness';

const TOKEN = 'control-token';

describe('apps/server/api/services: LiveCompanionService', () => {
  let repositories: InMemoryRepositories;
  let gateway: InMemoryLiveGateway;
  let cache: InMemoryCacheClient;
  let service: LiveCompanionService;

  async function setUp(world: Parameters<typeof liveWorld>[0] = {}) {
    ({ repositories } = await liveWorld(world));
    gateway = new InMemoryLiveGateway();
    cache = new InMemoryCacheClient();
    service = new LiveCompanionService({
      liveStreams: repositories.liveStreams,
      gateway,
      cache,
      now: () => STARTED.getTime() + 90_000,
    });
  }

  const command = async (frame: object) =>
    (await service.receive(TOKEN, JSON.stringify(frame))).result;

  beforeEach(async () => {
    await setUp();
  });

  it('greets the deck with the stream its token opens', async () => {
    expect(expectOk(await service.open(TOKEN))).toEqual({
      type: 'hello',
      stream: {
        id: STREAM_ID,
        status: 'LIVE',
        chat: { slowModeSeconds: 0, subscribersOnly: false },
      },
    });
    expect(expectErr(await service.open('overlay-token')).code).toBe(
      ErrorCodes.LIVE_STREAM_NOT_FOUND
    );
  });

  it('stops the broadcast: marks it stopping and drops the publisher', async () => {
    gateway.publish('live/stream-key');

    expectOk(await command({ type: 'stop', ref: 'deck-1' }));

    expect(expectOk(await gateway.isPublishing('live/stream-key'))).toBe(false);
    expect(
      expectOk(await repositories.liveStreams.findById(STREAM_ID))?.stopRequestedAt
    ).not.toBeNull();
  });

  it('switches the chat mode and tells the open chat sockets', async () => {
    const ack = expectOk(await command({ type: 'chat.mode', ref: 'deck-2', slowModeSeconds: 30 }));

    expect(ack).toMatchObject({
      type: 'ack',
      ref: 'deck-2',
      command: 'chat.mode',
      stream: { chat: { slowModeSeconds: 30 } },
    });
    expect(cache.publishedMessages.map(({ channel }) => channel)).toEqual([
      `live-chat:${STREAM_ID}`,
    ]);
  });

  it('drops a marker where the broadcast is now', async () => {
    expectOk(await command({ type: 'marker', label: 'Boss fight' }));

    expect(expectOk(await repositories.liveStreams.findById(STREAM_ID))?.markers).toEqual([
      { offsetMs: 90_000, label: 'Boss fight' },
    ]);
  });

  it.each([
    { scenario: 'a stop', frame: { type: 'stop' }, code: ErrorCodes.LIVE_STREAM_NOT_LIVE },
    { scenario: 'a marker', frame: { type: 'marker' }, code: ErrorCodes.LIVE_STREAM_NOT_LIVE },
    {
      scenario: 'a command it cannot read',
      frame: { type: 'start' },
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $scenario while the stream is idle', async ({ frame, code }) => {
    await setUp({ live: false });

    expect(expectErr(await command(frame)).code).toBe(code);
  });
});
