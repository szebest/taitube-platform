import { InMemoryRepositories } from '../in-memory-repositories';

describe('InMemoryWatchPartyRepositories', () => {
  it('is what InMemoryRepositories inherits its nine watch party repositories from', () => {
    const repositories = new InMemoryRepositories();

    expect(Object.keys(repositories).filter((key) => key.startsWith('watchParty'))).toHaveLength(9);
  });
});
