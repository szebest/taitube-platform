import { WATCH_PARTY_LIMITS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { resolveSource, type SourceAsk } from '../watch-party-sources';
import {
  OWNER,
  OTHER,
  seedParty,
  VIDEO_A,
  VIDEO_B,
  VIDEO_C,
  VIDEO_PRIVATE,
  VIDEO_UNLISTED,
  watchPartyTestDeps,
} from './watch-party-test-deps';

const ROOM = '018f0000-0000-7000-8000-00000000d001';
const OWNER_KEY = `user:${OWNER.id}`;
const ABSENT = '018f0000-0000-7000-8000-00000000d0ff';

async function setUpSources() {
  const test = watchPartyTestDeps();
  await seedParty(test);
  const playlist = async (videoIds: string[], ownerId = OWNER.id) => {
    const id = test.deps.secrets.newId();
    expectOk(
      await test.repositories.playlists.create({
        id,
        ownerId,
        title: 'Mix',
        description: '',
        visibility: 'public',
      })
    );
    for (const videoId of videoIds) {
      expectOk(
        await test.repositories.playlists.addItem(id, { id: test.deps.secrets.newId(), videoId })
      );
    }
    return id;
  };
  const resolve = (source: Parameters<typeof resolveSource>[2], ask: Partial<SourceAsk> = {}) =>
    resolveSource(
      test.deps,
      { roomId: ROOM, ownerKey: OWNER_KEY, actor: OWNER, visibility: 'unlisted', ...ask },
      source
    );
  return { ...test, playlist, resolve };
}

const videoIdsOf = (seed: { items: { videoId: string }[] }) =>
  seed.items.map(({ videoId }) => videoId);

describe('apps/server/api/services: resolveSource', () => {
  it('seeds an empty queue where there is no source', async () => {
    const { resolve } = await setUpSources();

    expect(expectOk(await resolve(undefined))).toEqual({ items: [], firstTitle: null });
  });

  it('seeds one item for a video, starting where it was asked to, owned by the room’s owner', async () => {
    const { resolve } = await setUpSources();

    const seed = expectOk(await resolve({ videoId: VIDEO_A, startMs: 12_000 }));

    expect(seed.firstTitle).toBe('First');
    expect(seed.items).toEqual([
      expect.objectContaining({
        roomId: ROOM,
        videoId: VIDEO_A,
        addedBy: OWNER_KEY,
        startMs: 12_000,
      }),
    ]);
  });

  it.each([
    {
      scenario: 'a playlist, skipping what the room may not play',
      source: 'playlist' as const,
      ids: [VIDEO_C, VIDEO_PRIVATE, VIDEO_A, VIDEO_UNLISTED],
      visibility: 'public' as const,
      expected: [VIDEO_C, VIDEO_A],
    },
    {
      scenario: 'a playlist in a room where unlisted is fine',
      source: 'playlist' as const,
      ids: [VIDEO_B, VIDEO_UNLISTED],
      visibility: 'unlisted' as const,
      expected: [VIDEO_B, VIDEO_UNLISTED],
    },
    {
      scenario: 'a list of videos in the order given',
      source: 'videos' as const,
      ids: [VIDEO_B, VIDEO_A, VIDEO_C],
      visibility: 'unlisted' as const,
      expected: [VIDEO_B, VIDEO_A, VIDEO_C],
    },
    {
      scenario: 'a list from its start index, skipping what the room may not play',
      source: 'videos' as const,
      start: 1,
      ids: [VIDEO_A, VIDEO_PRIVATE, VIDEO_C],
      visibility: 'unlisted' as const,
      expected: [VIDEO_C],
    },
  ])('queues $scenario', async ({ source, ids, start, visibility, expected }) => {
    const world = await setUpSources();
    const seed = expectOk(
      await world.resolve(
        source === 'playlist'
          ? { playlistId: await world.playlist(ids) }
          : { videoIds: ids, startIndex: start },
        { visibility }
      )
    );

    expect(videoIdsOf(seed)).toEqual(expected);
  });

  it('queues at most what a room may hold', async () => {
    const world = await setUpSources();
    const many = Array.from({ length: WATCH_PARTY_LIMITS.queueItems + 5 }, () => VIDEO_A);
    const seed = expectOk(await world.resolve({ videoIds: many }));

    expect(seed.items).toHaveLength(WATCH_PARTY_LIMITS.queueItems);
  });

  it('reads a playlist as the caller does: another account’s private playlist is nothing', async () => {
    const world = await setUpSources();
    const id = await world.playlist([VIDEO_A]);
    expectOk(await world.repositories.playlists.update(id, { visibility: 'private' }));

    expect(expectErr(await world.resolve({ playlistId: id }, { actor: OTHER })).code).toBe(
      ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE
    );
  });

  it.each([
    {
      scenario: 'a private video',
      source: { videoId: VIDEO_PRIVATE },
      visibility: 'unlisted' as const,
      reason: 'private',
    },
    {
      scenario: 'an unlisted video in a public room',
      source: { videoId: VIDEO_UNLISTED },
      visibility: 'public' as const,
      reason: 'unlisted',
    },
    {
      scenario: 'a video that is not there',
      source: { videoId: ABSENT },
      visibility: 'unlisted' as const,
      reason: 'missing',
    },
    {
      scenario: 'a list of nothing playable',
      source: { videoIds: [VIDEO_PRIVATE, ABSENT] },
      visibility: 'unlisted' as const,
      reason: 'private',
    },
    {
      scenario: 'a list started past its end',
      source: { videoIds: [VIDEO_A], startIndex: 1 },
      visibility: 'unlisted' as const,
      reason: 'missing',
    },
  ])('refuses $scenario, saying why for the log', async ({ source, visibility, reason }) => {
    const { resolve } = await setUpSources();

    expect(expectErr(await resolve(source, { visibility }))).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE,
      reason,
    });
  });

  it('refuses a playlist with nothing playable in it', async () => {
    const world = await setUpSources();
    const playlistId = await world.playlist([VIDEO_PRIVATE]);

    expect(expectErr(await world.resolve({ playlistId }))).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE,
      reason: 'private',
    });
  });

  it('refuses a playlist that is not there', async () => {
    const { resolve } = await setUpSources();

    expect(expectErr(await resolve({ playlistId: ABSENT })).code).toBe(
      ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE
    );
  });
});
