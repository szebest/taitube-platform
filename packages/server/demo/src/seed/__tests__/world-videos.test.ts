import { createRng } from '../rng';
import { buildUsers } from '../world-users';
import { buildVideos } from '../world-videos';

const owners = buildUsers(createRng(5), 12, 4).filter((user) => user.ownsChannel);

describe('seed/world-videos: buildVideos', () => {
  const videos = buildVideos(createRng(9), owners, 24, 30);

  it('numbers the videos and deals them out round the owners', () => {
    expect(videos).toHaveLength(24);
    expect(videos[0]?.key).toBe('v01');
    expect(videos.map((video) => video.ownerId).slice(0, 5)).toEqual(
      [0, 1, 2, 3, 0].map((index) => owners[index]?.id)
    );
  });

  it('keeps titles unique per owner and clips inside the length bounds', () => {
    const pairs = videos.map((video) => `${video.ownerId}/${video.title}`);

    expect(new Set(pairs).size).toBe(pairs.length);
    expect(videos.every((video) => video.seconds >= 8 && video.seconds <= 30)).toBe(true);
    expect(videos.every((video) => video.tags.length === 3 && video.tags[0] === 'demo')).toBe(true);
  });

  it('makes every fourth video a Short and the last two non-public once there are enough', () => {
    expect(videos.filter((video) => video.shape === 'short')).toHaveLength(6);
    expect(videos.slice(-2).map((video) => video.visibility)).toEqual(['unlisted', 'private']);
    expect(videos.slice(0, -2).every((video) => video.visibility === 'public')).toBe(true);
  });

  it.each([
    { count: 3, shorts: 0, nonPublic: 0 },
    { count: 5, shorts: 1, nonPublic: 0 },
    { count: 0, shorts: 0, nonPublic: 0 },
  ])('builds $count videos with $shorts Shorts', ({ count, shorts, nonPublic }) => {
    const built = buildVideos(createRng(2), owners, count, 16);

    expect(built).toHaveLength(count);
    expect(built.filter((video) => video.shape === 'short')).toHaveLength(shorts);
    expect(built.filter((video) => video.visibility !== 'public')).toHaveLength(nonPublic);
  });

  it('builds nothing without an owner', () => {
    expect(buildVideos(createRng(2), [], 5, 16)).toEqual([]);
  });
});
