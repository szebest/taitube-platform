import { SEEDED } from '@vp/testing';
import { createRng } from '../rng';
import { buildEngagement } from '../world-engagement';
import { buildUsers } from '../world-users';
import { buildVideos } from '../world-videos';

const users = buildUsers(createRng(1), 12, 4);
const videos = buildVideos(
  createRng(2),
  users.filter((user) => user.ownsChannel),
  8,
  16
);
const engagement = buildEngagement(createRng(3), users, videos);

describe('seed/world-engagement: buildEngagement', () => {
  it('comments on videos that are not private, never as the owner, pinning the first', () => {
    const privateKeys = videos.filter((v) => v.visibility === 'private').map((v) => v.key);
    const ownerOf = new Map(videos.map((video) => [video.key, video.ownerId]));

    expect(engagement.comments.length).toBeGreaterThan(0);
    for (const comment of engagement.comments) {
      expect(privateKeys).not.toContain(comment.videoKey);
      expect(comment.authorId).not.toBe(ownerOf.get(comment.videoKey));
      for (const reply of comment.replies) expect(reply.authorId).not.toBe(comment.authorId);
    }
    expect(engagement.comments.filter((comment) => comment.pinned).length).toBeGreaterThan(0);
  });

  it('only reacts to public videos and never subscribes anyone to themselves', () => {
    const publicKeys = new Set(videos.filter((v) => v.visibility === 'public').map((v) => v.key));

    expect(engagement.reactions.every((reaction) => publicKeys.has(reaction.videoKey))).toBe(true);
    expect(engagement.subscriptions.every((s) => s.subscriberId !== s.channelOwnerId)).toBe(true);
    expect(engagement.subscriptions.length).toBeGreaterThanOrEqual(users.length);
  });

  it('plans playlists, history, searches, reports and a featured shelf per channel', () => {
    expect(engagement.playlists.map((playlist) => playlist.ownerId)).toContain(SEEDED.otherUserId);
    expect(engagement.history.every((entry) => entry.fraction >= 0.2 && entry.fraction <= 1)).toBe(
      true
    );
    expect(engagement.searches).toHaveLength(3);
    expect(engagement.reports).toHaveLength(2);
    expect(engagement.reports.every((r) => r.reporterId !== r.commentAuthorId)).toBe(true);
    expect(engagement.featured.length).toBeGreaterThan(0);
  });

  it('plans nothing that needs a video when there are none', () => {
    const empty = buildEngagement(createRng(3), users, []);

    expect(empty).toMatchObject({ comments: [], reactions: [], playlists: [], history: [] });
    expect(empty.featured).toEqual([]);
  });
});
