import { shuffledBySeed } from '../layout-order.rule';

const ITEMS = Array.from({ length: 20 }, (_, index) => index);

describe('@vp/domain-rules: shuffledBySeed', () => {
  it('orders the same way for the same seed and keeps every item', () => {
    const first = shuffledBySeed(ITEMS, 'visit-1');

    expect(shuffledBySeed(ITEMS, 'visit-1')).toEqual(first);
    expect([...first].sort((a, b) => a - b)).toEqual(ITEMS);
  });

  it('orders differently for another seed', () => {
    expect(shuffledBySeed(ITEMS, 'visit-1')).not.toEqual(shuffledBySeed(ITEMS, 'visit-2'));
  });
});
