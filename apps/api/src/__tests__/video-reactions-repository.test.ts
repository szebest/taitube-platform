import {
  InMemoryRepositories,
  InMemoryVideoReactionRepository,
  InMemoryVideoRepository,
} from '@vp/adapters';
import { expectOk } from '@vp/testing/result';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Video Reaction Repositories (Ticket 40)', () => {
  let videoRepo: InMemoryVideoRepository;
  let reactionRepo: InMemoryVideoReactionRepository;

  beforeEach(() => {
    videoRepo = new InMemoryVideoRepository();
    reactionRepo = new InMemoryVideoReactionRepository({ videosRepo: videoRepo });
  });

  it.each([
    { type: 'LIKE' as const, likesCount: 1, dislikesCount: 0 },
    { type: 'DISLIKE' as const, likesCount: 0, dislikesCount: 1 },
  ])('records an initial $type and updates the counter', async ({ type, ...counts }) => {
    const videoId = '11111111-1111-7111-8111-111111111111';
    const userId = 'user-1';

    const result = expectOk(await reactionRepo.setReaction(videoId, userId, type));
    expect(result).toMatchObject({ previousType: null, newType: type, ...counts });

    expect(expectOk(await reactionRepo.getUserReaction(videoId, userId))).toBe(type);
    expect(expectOk(await reactionRepo.getReactionCounts(videoId))).toEqual(counts);
    expect(expectOk(await reactionRepo.countGroundTruth(videoId))).toEqual(counts);
  });

  it('idempotency: repeatedly liking the same video does not double increment', async () => {
    const videoId = '11111111-1111-7111-8111-111111111111';
    const userId = 'user-3';

    await reactionRepo.setReaction(videoId, userId, 'LIKE');
    const second = expectOk(await reactionRepo.setReaction(videoId, userId, 'LIKE'));

    expect(second.previousType).toBe('LIKE');
    expect(second.newType).toBe('LIKE');
    expect(second.likesCount).toBe(1);
    expect(second.dislikesCount).toBe(0);

    const counts = expectOk(await reactionRepo.getReactionCounts(videoId));
    expect(counts).toEqual({ likesCount: 1, dislikesCount: 0 });
  });

  it('switching: liking a previously disliked video swaps counts correctly', async () => {
    const videoId = '11111111-1111-7111-8111-111111111111';
    const userId = 'user-4';

    // 1. Initial DISLIKE
    await reactionRepo.setReaction(videoId, userId, 'DISLIKE');
    expect(expectOk(await reactionRepo.getReactionCounts(videoId))).toEqual({
      likesCount: 0,
      dislikesCount: 1,
    });

    // 2. Switch to LIKE
    const switched = expectOk(await reactionRepo.setReaction(videoId, userId, 'LIKE'));
    expect(switched.previousType).toBe('DISLIKE');
    expect(switched.newType).toBe('LIKE');
    expect(switched.likesCount).toBe(1);
    expect(switched.dislikesCount).toBe(0);

    expect(expectOk(await reactionRepo.getReactionCounts(videoId))).toEqual({
      likesCount: 1,
      dislikesCount: 0,
    });

    const groundTruth = expectOk(await reactionRepo.countGroundTruth(videoId));
    expect(groundTruth).toEqual({ likesCount: 1, dislikesCount: 0 });
  });

  it('clearing: setting reaction to NONE removes reaction and decrements counter', async () => {
    const videoId = '11111111-1111-7111-8111-111111111111';
    const userId = 'user-5';

    await reactionRepo.setReaction(videoId, userId, 'LIKE');
    const cleared = expectOk(await reactionRepo.setReaction(videoId, userId, 'NONE'));

    expect(cleared.previousType).toBe('LIKE');
    expect(cleared.newType).toBeNull();
    expect(cleared.likesCount).toBe(0);
    expect(cleared.dislikesCount).toBe(0);

    const userReaction = expectOk(await reactionRepo.getUserReaction(videoId, userId));
    expect(userReaction).toBeNull();

    const groundTruth = expectOk(await reactionRepo.countGroundTruth(videoId));
    expect(groundTruth).toEqual({ likesCount: 0, dislikesCount: 0 });
  });

  it('updates denormalized counters on InMemoryVideoRepository when video exists', async () => {
    const video = expectOk(
      await videoRepo.create({
        id: '22222222-2222-7222-8222-222222222222',
        ownerId: 'owner-1',
        sourceKey: 'raw/video.mp4',
      })
    );

    await reactionRepo.setReaction(video.id, 'user-1', 'LIKE');
    await reactionRepo.setReaction(video.id, 'user-2', 'LIKE');
    await reactionRepo.setReaction(video.id, 'user-3', 'DISLIKE');

    const updated = expectOk(await videoRepo.findById(video.id));
    expect(updated?.likesCount).toBe(2);
    expect(updated?.dislikesCount).toBe(1);
  });

  it('InMemoryRepositories wires videoReactions and clears state on clear()', async () => {
    const repos = new InMemoryRepositories();
    const videoId = '33333333-3333-7333-8333-333333333333';

    await repos.videoReactions.setReaction(videoId, 'user-1', 'LIKE');
    expect(expectOk(await repos.videoReactions.getUserReaction(videoId, 'user-1'))).toBe('LIKE');

    repos.clear();
    expect(expectOk(await repos.videoReactions.getUserReaction(videoId, 'user-1'))).toBeNull();
    expect(expectOk(await repos.videoReactions.getReactionCounts(videoId))).toEqual({
      likesCount: 0,
      dislikesCount: 0,
    });
  });

  it('listVideoIdsWithReactions returns distinct video IDs', async () => {
    const v1 = 'vid-1';
    const v2 = 'vid-2';

    await reactionRepo.setReaction(v1, 'u1', 'LIKE');
    await reactionRepo.setReaction(v1, 'u2', 'DISLIKE');
    await reactionRepo.setReaction(v2, 'u3', 'LIKE');

    const videoIds = expectOk(await reactionRepo.listVideoIdsWithReactions());
    expect(videoIds).toHaveLength(2);
    expect(videoIds).toContain(v1);
    expect(videoIds).toContain(v2);
  });
});
