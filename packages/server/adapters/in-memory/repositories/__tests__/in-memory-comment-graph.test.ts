import { graph } from '../in-memory-graph';
import { Repo } from '../in-memory-repo-tokens';

describe('adapters/in-memory: comment repository graph', () => {
  it('registers every repository the comments side needs', () => {
    const container = graph();

    expect([
      container.get(Repo.commentSettings),
      container.get(Repo.channelUserRestrictions),
      container.get(Repo.trustedCommenters),
      container.get(Repo.comments),
      container.get(Repo.commentModeration),
      container.get(Repo.commentReports),
    ]).not.toContain(undefined);
  });
});
