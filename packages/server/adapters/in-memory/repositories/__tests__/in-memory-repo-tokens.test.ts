import { Repo } from '../in-memory-repo-tokens';

describe('in-memory repository tokens', () => {
  it('names each token after the key it is held under, so no two repositories share one', () => {
    for (const [key, token] of Object.entries(Repo)) {
      expect(token.name).toBe(key);
    }
  });
});
