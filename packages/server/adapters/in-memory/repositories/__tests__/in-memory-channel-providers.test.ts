import { Container } from '@kit/composition';
import { provideChannels } from '../in-memory-channel-providers';
import { graph } from '../in-memory-graph';
import { Repo } from '../in-memory-repo-tokens';

describe('provideChannels', () => {
  it('provides the repositories lazily, so the channels resolve only once the videos they read exist', () => {
    const container = provideChannels(new Container(), Date.now);

    expect(container.get(Repo.channelAudit)).toBe(container.get(Repo.channelAudit));
    expect(() => container.get(Repo.channels)).toThrow();
  });

  it('is part of the in-memory graph', () => {
    const c = graph();

    expect(c.get(Repo.channels)).toBe(c.get(Repo.channels));
    expect(c.get(Repo.channelInvites)).toBe(c.get(Repo.channelInvites));
  });
});
