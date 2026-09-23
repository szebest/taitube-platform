import { Adapters } from '../adapter-tokens';

describe('adapter tokens', () => {
  it('names each token after its key, so a cycle or a missing provider reads plainly', () => {
    const mismatched = Object.entries(Adapters).filter(([key, t]) => t.name !== key);

    expect(mismatched).toEqual([]);
  });
});
