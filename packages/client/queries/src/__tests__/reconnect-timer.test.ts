import { createReconnectTimer } from '../reconnect-timer';

describe('packages/queries: createReconnectTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function waitsBeforeEachRetry(steps: readonly ('retry' | 'reset')[]) {
    const reconnect = vi.fn();
    const timer = createReconnectTimer(reconnect);
    const waits: number[] = [];
    for (const step of steps) {
      if (step === 'reset') {
        timer.reset();
        continue;
      }
      const before = reconnect.mock.calls.length;
      timer.schedule();
      let waited = 0;
      while (reconnect.mock.calls.length === before) {
        vi.advanceTimersByTime(1_000);
        waited += 1_000;
      }
      waits.push(waited);
    }
    return waits;
  }

  it.each([
    {
      case: 'doubles each wait up to 30 s',
      steps: ['retry', 'retry', 'retry', 'retry', 'retry', 'retry', 'retry'],
      waits: [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000],
    },
    {
      case: 'starts over at 1 s once reset',
      steps: ['retry', 'retry', 'reset', 'retry'],
      waits: [1_000, 2_000, 1_000],
    },
  ] as const)('$case', ({ steps, waits }) => {
    expect(waitsBeforeEachRetry(steps)).toEqual(waits);
  });

  it('does not reconnect once cancelled', () => {
    const reconnect = vi.fn();
    const timer = createReconnectTimer(reconnect);

    timer.schedule();
    timer.cancel();
    vi.advanceTimersByTime(30_000);

    expect(reconnect).not.toHaveBeenCalled();
  });
});
