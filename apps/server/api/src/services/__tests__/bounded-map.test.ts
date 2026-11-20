import { boundedMap } from '../bounded-map';

function deferred() {
  let release: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { done, release };
}

describe('apps/server/api/services: boundedMap', () => {
  it('keeps the order of the items whatever order the calls finish in', async () => {
    const gates = [deferred(), deferred(), deferred()];

    const running = boundedMap([0, 1, 2], 3, async (index) => {
      await gates[index]?.done;
      return index;
    });
    gates[2]?.release();
    gates[0]?.release();
    gates[1]?.release();

    expect(await running).toEqual([0, 1, 2]);
  });

  it.each([
    { limit: 1, items: 5 },
    { limit: 3, items: 8 },
    { limit: 10, items: 4 },
  ])('never has more than $limit of $items calls in flight', async ({ limit, items }) => {
    let inFlight = 0;
    let peak = 0;

    await boundedMap(Array.from({ length: items }), limit, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      await Promise.resolve();
      inFlight--;
    });

    expect(peak).toBe(Math.min(limit, items));
  });

  it('answers an empty list without calling anything', async () => {
    expect(await boundedMap([], 4, async () => 1)).toEqual([]);
  });
});
