import { Container } from '@kit/composition';
import { graph } from '../in-memory-graph';
import { Repo } from '../in-memory-repo-tokens';
import { provideVideoTools } from '../in-memory-video-tools-providers';

describe('provideVideoTools', () => {
  it('provides the stores lazily, so the studio repository resolves only once the videos it edits exist', () => {
    const container = provideVideoTools(new Container());

    expect(container.get(Repo.entityRevisions)).toBe(container.get(Repo.entityRevisions));
    expect(container.get(Repo.videoChapters)).toBe(container.get(Repo.videoChapters));
    expect(() => container.get(Repo.videoStudio)).toThrow();
  });

  it('is part of the in-memory graph, one store behind both the studio and the readers', () => {
    const c = graph();

    expect(c.get(Repo.videoStudio)).toBe(c.get(Repo.videoStudio));
    expect(c.get(Repo.videoCorrections)).toBe(c.get(Repo.videoCorrections));
  });
});
