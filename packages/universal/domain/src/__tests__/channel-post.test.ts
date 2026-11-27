import { POST_KINDS, POST_LIFECYCLE_EDGES, POST_STATUSES, POSTS_PER_DAY } from '../channel-post';

describe('@vp/domain: channel post', () => {
  it('limits posts per day to 20', () => {
    expect(POSTS_PER_DAY).toBe(20);
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
