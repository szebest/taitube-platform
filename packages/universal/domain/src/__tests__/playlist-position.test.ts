import {
  POSITION_GAP,
  type PositionWrite,
  type PositionedItem,
  appendPosition,
  movePositions,
  renumberPositions,
} from '../playlist-position';

const MAX_POSITION = 2 ** 31 - 1;

function spaced(...ids: string[]): PositionedItem[] {
  return ids.map((id, index) => ({ id, position: index * POSITION_GAP }));
}

function applied(items: readonly PositionedItem[], writes: readonly PositionWrite[]): string[] {
  const moved = new Map(writes.map((write) => [write.id, write.position]));
  return items
    .map((item) => ({ id: item.id, position: moved.get(item.id) ?? item.position }))
    .sort((a, b) => a.position - b.position)
    .map((item) => item.id);
}

describe('@vp/domain: appendPosition', () => {
  it.each([
    { scenario: 'an empty playlist', last: null, expected: 0 },
    { scenario: 'a playlist ending at 2048', last: 2048, expected: 2048 + POSITION_GAP },
    { scenario: 'a playlist ending below zero', last: -3, expected: -3 + POSITION_GAP },
  ])('places the first free slot after $scenario', ({ last, expected }) => {
    expect(appendPosition(last)).toBe(expected);
  });

  it('asks for a renumber when the next slot would overflow an integer column', () => {
    expect(appendPosition(MAX_POSITION - 1)).toBeNull();
  });
});

describe('@vp/domain: renumberPositions', () => {
  it('spaces the order a gap apart from zero', () => {
    expect(renumberPositions(['a', 'b', 'c'])).toEqual([
      { id: 'a', position: 0 },
      { id: 'b', position: POSITION_GAP },
      { id: 'c', position: 2 * POSITION_GAP },
    ]);
  });
});

describe('@vp/domain: movePositions', () => {
  const five = spaced('v0', 'v1', 'v2', 'v3', 'v4');

  it.each([
    { scenario: 'the last item to the front', itemId: 'v4', index: 0, order: 'v4 v0 v1 v2 v3' },
    { scenario: 'the last item to slot 1', itemId: 'v4', index: 1, order: 'v0 v4 v1 v2 v3' },
    { scenario: 'the first item to the end', itemId: 'v0', index: 4, order: 'v1 v2 v3 v4 v0' },
    { scenario: 'an item past the end', itemId: 'v1', index: 99, order: 'v0 v2 v3 v4 v1' },
    { scenario: 'a middle item down one', itemId: 'v1', index: 2, order: 'v0 v2 v1 v3 v4' },
  ])('moves $scenario by rewriting that item alone', ({ itemId, index, order }) => {
    const writes = movePositions(five, itemId, index);

    expect(writes).toHaveLength(1);
    expect(writes?.[0]?.id).toBe(itemId);
    expect(applied(five, writes ?? [])).toEqual(order.split(' '));
  });

  it.each([
    { scenario: 'an item onto its own slot', items: five, itemId: 'v2', index: 2 },
    { scenario: 'the only item', items: spaced('v0'), itemId: 'v0', index: 3 },
  ])('writes nothing for $scenario', ({ items, itemId, index }) => {
    expect(movePositions(items, itemId, index)).toEqual([]);
  });

  it('answers null for an item the playlist does not hold', () => {
    expect(movePositions(five, 'absent', 0)).toBeNull();
  });

  it('renumbers the whole playlist once two neighbours leave no room between them', () => {
    const crowded = [
      { id: 'v0', position: 0 },
      { id: 'v1', position: 1 },
      { id: 'v2', position: 2 },
    ];

    const writes = movePositions(crowded, 'v2', 1) ?? [];

    expect(writes).toHaveLength(3);
    expect(applied(crowded, writes)).toEqual(['v0', 'v2', 'v1']);
    expect(writes.map((write) => write.position)).toEqual([0, POSITION_GAP, 2 * POSITION_GAP]);
  });

  it('renumbers rather than leave the integer range at either end', () => {
    const edge = [
      { id: 'v0', position: 0 },
      { id: 'v1', position: MAX_POSITION },
    ];

    const writes = movePositions(edge, 'v0', 1) ?? [];

    expect(applied(edge, writes)).toEqual(['v1', 'v0']);
    expect(Math.max(...writes.map((write) => write.position))).toBeLessThanOrEqual(MAX_POSITION);
  });

  it('keeps an order stable through many moves into the same gap', () => {
    let items = spaced('a', 'b', 'c');
    for (let round = 0; round < 40; round++) {
      const last = items[items.length - 1]?.id ?? '';
      const writes = movePositions(items, last, 1) ?? [];
      const moved = new Map(writes.map((write) => [write.id, write.position]));
      items = items
        .map((item) => ({ id: item.id, position: moved.get(item.id) ?? item.position }))
        .sort((x, y) => x.position - y.position);
    }

    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(new Set(items.map((item) => item.position)).size).toBe(3);
  });
});
