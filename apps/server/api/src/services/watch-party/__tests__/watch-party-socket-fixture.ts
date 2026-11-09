import type { WatchPartyServerFrame } from '@vp/api-contracts';
import type { WatchPartyPreset, WatchPartyRoom } from '@vp/domain';
import type { AppConfigOverrides } from '@vp/env-schema';
import { roomIdOfWatchParty, WATCH_PARTY_WILDCARD_CHANNEL } from '@vp/events';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { PatternHub } from '../../pattern-hub';
import { RoomBatcher } from '../room-batcher';
import { type RoomEnvelope, RoomEnvelopeSchema } from '../watch-party-broadcaster';
import { BufferingWait } from '../watch-party-buffering';
import { OwnerGrace } from '../watch-party-owner-grace';
import { flushRoster } from '../watch-party-roster-feed';
import { flushReactions } from '../watch-party-signals';
import type { RoomSocketDeps } from '../watch-party-socket-service';
import { keyOf, ROOM_ID, seatUser, seedRoom } from './watch-party-moderation-fixture';
import { MEMBER, OWNER, VIDEO_A, VIDEO_B, watchPartyTestDeps } from './watch-party-test-deps';

export const ORIGIN = 'http://localhost:5173';

const DRAIN_ROUNDS = 50;

/** Only the timers are fake; the in-memory stores answer on microtasks alone. */
export function fakeTimers(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
}

/** Lets the work a fired timer or a dropped promise started run to its end. */
export async function drainMicrotasks(): Promise<void> {
  for (let round = 0; round < DRAIN_ROUNDS; round += 1) await Promise.resolve();
}

/** Moves the fake timers on, then drains: `bun test` has no async advance. */
export async function elapse(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await drainMicrotasks();
}

type Frame = WatchPartyServerFrame;

/**
 * A seeded room with the owner and a member seated, two queued videos, and every per-pod part of
 * the room socket over the in-memory cache the test deps publish to.
 */
export async function socketRoom(
  options: { preset?: WatchPartyPreset; config?: AppConfigOverrides; members?: UserContext[] } = {}
) {
  const test = watchPartyTestDeps({ config: options.config });
  const { deps, repositories, cache } = test;
  const at = deps.now();
  await seedRoom(repositories, OWNER, at, options.preset);
  for (const member of options.members ?? [MEMBER]) await seatUser(repositories, member, at);
  for (const [index, videoId] of [VIDEO_A, VIDEO_B].entries()) {
    expectOk(
      await repositories.videos.create({
        id: videoId,
        ownerId: OWNER.id,
        title: `Video ${index}`,
        visibility: 'public',
        status: 'READY',
        sourceKey: `raw/${videoId}/source.mp4`,
        durationMs: 60_000,
      })
    );
  }
  const queued = expectOk(
    await repositories.watchPartyQueue.append(
      ROOM_ID,
      [VIDEO_A, VIDEO_B].map((videoId, index) => ({
        id: `018f0000-0000-7000-8000-0000000c000${index + 1}`,
        roomId: ROOM_ID,
        videoId,
        addedBy: keyOf(OWNER),
        startMs: 0,
        createdAt: at,
      })),
      200
    )
  );
  const items = queued.type === 'applied' ? queued.queue.items : [];

  const socketDeps: RoomSocketDeps = {
    ...deps,
    hub: new PatternHub<RoomEnvelope>({
      cache,
      logger: deps.logger,
      pattern: WATCH_PARTY_WILDCARD_CHANNEL,
      keyOf: roomIdOfWatchParty,
      schema: RoomEnvelopeSchema,
    }),
    allowedOrigins: [ORIGIN],
    reactions: new RoomBatcher({
      windowMs: deps.config.reactionsFoldMs,
      flush: flushReactions(deps),
    }),
    roster: new RoomBatcher({ windowMs: deps.config.rosterBatchMs, flush: flushRoster(deps) }),
    buffering: new BufferingWait(deps),
    ownerGrace: new OwnerGrace(deps),
  };

  /** The room at its current versions. */
  const room = async (): Promise<WatchPartyRoom> => {
    const found = expectOk(await repositories.watchPartyRooms.findById(ROOM_ID));
    if (found === null) throw new Error('the seeded room is gone');
    return found;
  };

  /** Puts the room on the first item, playing from `positionMs` as of now. */
  const play = async (positionMs = 0) => {
    const current = await room();
    expectOk(
      await repositories.watchPartyRooms.commitPlayback(ROOM_ID, {
        expected: { playbackVersion: current.playbackVersion, rolesVersion: current.rolesVersion },
        playback: {
          itemId: items[0]?.id ?? null,
          phase: 'playing',
          positionMs,
          rate: 1,
          anchorAt: deps.now().getTime(),
        },
        currentVideoId: VIDEO_A,
        line: null,
        at: deps.now(),
      })
    );
    cache.publishedMessages.length = 0;
    return room();
  };

  /** Every frame published on the room channel, of one type. */
  const published = <T extends Frame['type']>(type: T) =>
    test
      .everyFrame()
      .map(({ frame }) => frame)
      .filter((frame): frame is Extract<Frame, { type: T }> => frame.type === type);

  return { ...test, socketDeps, items, room, play, published };
}
