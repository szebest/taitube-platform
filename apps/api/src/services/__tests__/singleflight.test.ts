import { describe, expect, it } from 'vitest';
import { Singleflight } from '../singleflight';

describe('Singleflight', () => {
  it('coalesces multiple concurrent calls with the same key into a single execution', async () => {
    const sf = new Singleflight();
    let executionCount = 0;

    const task = async () => {
      executionCount++;
      await new Promise((r) => setTimeout(r, 20));
      return { data: 'result-123' };
    };

    // Launch 100 concurrent callers
    const callers = Array.from({ length: 100 }, () => sf.do('key-1', task));
    const results = await Promise.all(callers);

    expect(executionCount).toBe(1);
    for (const res of results) {
      expect(res).toEqual({ data: 'result-123' });
    }
  });

  it('runs again after the previous in-flight promise completes', async () => {
    const sf = new Singleflight();
    let count = 0;

    const run1 = await sf.do('k', async () => ++count);
    expect(run1).toBe(1);

    const run2 = await sf.do('k', async () => ++count);
    expect(run2).toBe(2);
  });

  it('handles rejections by propagating error to all callers and clearing in-flight entry', async () => {
    const sf = new Singleflight();
    const failingTask = async () => {
      await new Promise((r) => setTimeout(r, 10));
      throw new Error('boom');
    };

    const c1 = sf.do('err-key', failingTask);
    const c2 = sf.do('err-key', failingTask);

    const [r1, r2] = await Promise.allSettled([c1, c2]);
    expect(r1.status).toBe('rejected');
    expect(r2.status).toBe('rejected');
    if (r1.status === 'rejected') {
      expect((r1.reason as Error).message).toBe('boom');
    }
    if (r2.status === 'rejected') {
      expect((r2.reason as Error).message).toBe('boom');
    }
    expect(sf.inFlightCount).toBe(0);

    // Can succeed on retry
    const res = await sf.do('err-key', async () => 'recovered');
    expect(res).toBe('recovered');
  });

  it('executes different keys independently', async () => {
    const sf = new Singleflight();
    const [resA, resB] = await Promise.all([
      sf.do('keyA', async () => 'valueA'),
      sf.do('keyB', async () => 'valueB'),
    ]);

    expect(resA).toBe('valueA');
    expect(resB).toBe('valueB');
  });
});
