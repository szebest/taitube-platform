import { Services } from '../service-tokens';

describe('apps/api/composition: service tokens', () => {
  it('names each token after its key, so a cycle or a missing provider reads plainly', () => {
    const mismatched = Object.entries(Services).filter(([key, t]) => t.name !== key);

    expect(mismatched).toEqual([]);
  });
});
