import { CircuitBreaker } from '../circuit-breaker';

describe('CircuitBreaker', () => {
  let now: number;
  let breaker: CircuitBreaker;

  beforeEach(() => {
    now = 0;
    breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1_000, now: () => now });
  });

  const failTimes = (count: number) => {
    for (let i = 0; i < count; i++) breaker.recordFailure();
  };

  it('stays closed below the threshold', () => {
    failTimes(2);

    expect(breaker.state()).toBe('closed');
    expect(breaker.allows()).toBe(true);
  });

  it('opens on the threshold and refuses calls until the cooldown passes', () => {
    failTimes(3);
    now = 999;

    expect(breaker.state()).toBe('open');
    expect(breaker.allows()).toBe(false);
  });

  it('forgets earlier failures after a success', () => {
    failTimes(2);
    breaker.recordSuccess();
    failTimes(2);

    expect(breaker.state()).toBe('closed');
  });

  it('lets a trial call through once the cooldown passes', () => {
    failTimes(3);
    now = 1_000;

    expect(breaker.state()).toBe('half-open');
    expect(breaker.allows()).toBe(true);
  });

  it.each([
    { outcome: 'success', record: (b: CircuitBreaker) => b.recordSuccess(), state: 'closed' },
    { outcome: 'failure', record: (b: CircuitBreaker) => b.recordFailure(), state: 'open' },
  ])('ends the trial in $state on a $outcome', ({ record, state }) => {
    failTimes(3);
    now = 1_000;

    record(breaker);

    expect(breaker.state()).toBe(state);
  });

  it('opens for a fresh cooldown from the failed trial', () => {
    failTimes(3);
    now = 1_500;
    breaker.recordFailure();
    now = 2_499;

    expect(breaker.state()).toBe('open');
  });
});
