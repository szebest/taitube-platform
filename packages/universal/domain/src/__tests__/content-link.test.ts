import {
  CHAIN_RELATIONS,
  type ContentRef,
  NO_ANCHORS,
  RELATIONS,
  clampAnchors,
  contentRefKey,
  fromStoredRef,
  hasTimeline,
  toStoredRef,
} from '../content-link';

describe('@vp/domain: content-link', () => {
  it.each<ContentRef>([
    { type: 'video', id: 'v1' },
    { type: 'post', id: 'p1' },
    { type: 'episode', playlistId: 'pl1', videoId: 'v2' },
  ])('stores and reads back $type', (ref) => {
    expect(fromStoredRef(toStoredRef(ref))).toEqual(ref);
  });

  it('keys an episode by its playlist too', () => {
    expect(contentRefKey({ type: 'episode', playlistId: 'a', videoId: 'v' })).not.toBe(
      contentRefKey({ type: 'episode', playlistId: 'b', videoId: 'v' })
    );
  });

  it.each([
    { type: 'video', expected: true },
    { type: 'episode', expected: true },
    { type: 'post', expected: false },
    { type: 'playlist', expected: false },
  ] as const)('$type has a timeline: $expected', ({ type, expected }) => {
    expect(hasTimeline(type)).toBe(expected);
  });

  it('allows only the relations about another creator to cross channels', () => {
    const crossing = Object.entries(RELATIONS)
      .filter(([, spec]) => spec.acrossChannels)
      .map(([relation]) => relation);

    expect(crossing).toEqual(['response_to', 'reaction_to', 'remix_of', 'discussion', 'related']);
  });

  it('checks loops on previous, part_of and follow_up only', () => {
    expect(CHAIN_RELATIONS).toEqual(['part_of', 'previous', 'follow_up']);
  });

  it('clamps anchors into the current durations and leaves missing ones alone', () => {
    const anchors = { ...NO_ANCHORS, sourceEndMs: 90_000, targetStartMs: -5, targetEndMs: 4_000 };

    expect(clampAnchors(anchors, 60_000, null)).toEqual({
      sourceStartMs: null,
      sourceEndMs: 60_000,
      targetStartMs: -5,
      targetEndMs: 4_000,
    });
  });
});
