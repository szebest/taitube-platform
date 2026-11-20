import { graph } from '../in-memory-graph';
import { Repo } from '../in-memory-repo-tokens';
import { InMemoryVideoToolsRepositories } from '../in-memory-video-tools-repositories';

describe('InMemoryVideoToolsRepositories', () => {
  it('exposes the very stores the graph built, so an edit and a read see one history', () => {
    const c = graph();

    const repositories = new InMemoryVideoToolsRepositories(c);

    expect(repositories.entityRevisions).toBe(c.get(Repo.entityRevisions));
    expect(repositories.videoChapters).toBe(c.get(Repo.videoChapters));
    expect(repositories.videoCorrections).toBe(c.get(Repo.videoCorrections));
  });
});
