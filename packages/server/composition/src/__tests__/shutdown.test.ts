import { type ShutdownPlan, shutdownOnce } from '../shutdown';

function plan(overrides: Partial<ShutdownPlan> = {}) {
  const events: string[] = [];
  const base: ShutdownPlan = {
    drain: () => void events.push('drain'),
    drainDelayMs: 0,
    close: async () => void events.push('close'),
    graceMs: 1_000,
    pending: () => undefined,
    log: (message) => void events.push(`log: ${message}`),
  };
  return { events, plan: { ...base, ...overrides } };
}

describe('packages/composition: shutdownOnce', () => {
  it('drains before it closes, and reports a clean drain', async () => {
    const { events, plan: p } = plan();

    expect(await shutdownOnce(p)()).toBe('drained');
    expect(events.filter((e) => !e.startsWith('log'))).toEqual(['drain', 'close']);
  });

  it('keeps the server open for the drain delay after readiness flips', async () => {
    const { events, plan: p } = plan({ drainDelayMs: 30 });
    const shutdown = shutdownOnce(p)();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(events).toContain('drain');
    expect(events).not.toContain('close');
    await shutdown;
    expect(events).toContain('close');
  });

  it('runs once however many signals arrive', async () => {
    const close = vi.fn(async () => {});
    const shutdown = shutdownOnce(plan({ close }).plan);

    await Promise.all([shutdown(), shutdown()]);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('gives up after the grace window and names what it was still waiting on', async () => {
    const { events, plan: p } = plan({
      graceMs: 20,
      close: () => new Promise(() => {}),
      pending: () => 'PostgresRepositories',
    });

    expect(await shutdownOnce(p)()).toBe('forced');
    expect(events.at(-1)).toContain('PostgresRepositories');
  });

  it('reports a close that failed, so the process does not exit 0', async () => {
    const { events, plan: p } = plan({
      close: async () => {
        throw new Error('socket hang up');
      },
    });

    expect(await shutdownOnce(p)()).toBe('failed');
    expect(events.at(-1)).toContain('socket hang up');
  });
});
