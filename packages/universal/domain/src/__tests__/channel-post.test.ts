import {
  POST_IMAGES_MAX,
  POST_IMAGE_ALT_MAX,
  POST_KINDS,
  POST_LIFECYCLE_EDGES,
  POST_SHARE_COMMENT_MAX,
  POST_STATUSES,
  POST_TEXT_MAX,
  POSTS_PER_DAY,
} from '../channel-post';

describe('@vp/domain: channel post', () => {
  it.each([
    { name: 'text', value: POST_TEXT_MAX, limit: 2000 },
    { name: 'images', value: POST_IMAGES_MAX, limit: 4 },
    { name: 'image alt text', value: POST_IMAGE_ALT_MAX, limit: 200 },
    { name: 'a share comment', value: POST_SHARE_COMMENT_MAX, limit: 500 },
    { name: 'posts per day', value: POSTS_PER_DAY, limit: 20 },
  ])('limits $name to $limit', ({ value, limit }) => {
    expect(value).toBe(limit);
  });

  it('names every kind and status once', () => {
    expect(new Set(POST_KINDS).size).toBe(POST_KINDS.length);
    expect(POST_STATUSES).toEqual(['draft', 'scheduled', 'published']);
  });

  it.each([
    { edge: 'schedule', from: ['draft'], to: 'scheduled' },
    { edge: 'publish', from: ['draft', 'scheduled'], to: 'published' },
  ] as const)('lets $edge take $from to $to', ({ edge, from, to }) => {
    expect(POST_LIFECYCLE_EDGES[edge]).toEqual({ from, to });
  });

  it('never leaves a published post', () => {
    const sources = Object.values(POST_LIFECYCLE_EDGES).flatMap((edge) => [...edge.from]);

    expect(sources).not.toContain('published');
  });
});
