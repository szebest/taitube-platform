import { Container } from '@vp/composition';
import { graph } from '../in-memory-graph';
import { Repo } from '../in-memory-repo-tokens';
import { provideScreening } from '../in-memory-screening-providers';

describe('provideScreening', () => {
  it('provides the repositories lazily, so the screening one resolves only once the videos and events it reads exist', () => {
    const container = provideScreening(new Container());

    expect(container.get(Repo.fingerprints)).toBe(container.get(Repo.fingerprints));
    expect(() => container.get(Repo.screenings)).toThrow();
  });

  it('is part of the in-memory graph', () => {
    const c = graph();

    expect(c.get(Repo.screenings)).toBe(c.get(Repo.screenings));
    expect(c.get(Repo.fingerprints)).toBe(c.get(Repo.fingerprints));
  });
});
