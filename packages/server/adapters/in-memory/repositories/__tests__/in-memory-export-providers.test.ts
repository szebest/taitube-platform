import { Container } from '@vp/composition';
import { provideExports } from '../in-memory-export-providers';
import { graph } from '../in-memory-graph';
import { Repo } from '../in-memory-repo-tokens';

describe('provideExports', () => {
  it('provides the export repository lazily, so it resolves only once the audit log it writes exists', () => {
    const container = provideExports(new Container(), Date.now);

    expect(() => container.get(Repo.dataExports)).toThrow();
  });

  it('is part of the in-memory graph', () => {
    const c = graph();

    expect(c.get(Repo.dataExports)).toBe(c.get(Repo.dataExports));
  });
});
