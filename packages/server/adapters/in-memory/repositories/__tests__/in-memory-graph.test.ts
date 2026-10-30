import { graph, Repo } from '../in-memory-graph';

describe('in-memory repository graph', () => {
  it('builds every repository once and hands the same instance to whoever asks again', () => {
    const c = graph();

    for (const token of Object.values(Repo)) {
      expect(c.get(token as never)).toBe(c.get(token as never));
    }
  });

  it('gives every repository the clear() a test double owes', () => {
    const c = graph();

    for (const token of Object.values(Repo)) {
      expect(c.get(token as never)).toHaveProperty('clear', expect.any(Function));
    }
  });
});
