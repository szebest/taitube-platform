import { expectOk } from '@kit/testing/result';
import { describeFixedWindowCounterContract } from '../../__tests__/contract/fixed-window-counter.contract';
import { InMemoryFixedWindowCounter } from '../in-memory-fixed-window-counter';

describeFixedWindowCounterContract(async () => {
  const counter = new InMemoryFixedWindowCounter();
  return { counter, restarted: async () => counter, close: async () => {} };
});

describe('InMemoryFixedWindowCounter', () => {
  it('opens a new window once the clock passes the old one, and forgets on clear', async () => {
    let nowMs = 0;
    const counter = new InMemoryFixedWindowCounter(() => nowMs);
    const hit = async () => expectOk(await counter.hit('k', 1_000));

    expect([await hit(), await hit()]).toEqual([
      { count: 1, resetInMs: 1_000 },
      { count: 2, resetInMs: 1_000 },
    ]);
    nowMs = 400;
    expect(await hit()).toEqual({ count: 3, resetInMs: 600 });
    nowMs = 1_000;
    expect(await hit()).toEqual({ count: 1, resetInMs: 1_000 });

    counter.clear();
    expect((await hit()).count).toBe(1);
  });
});
