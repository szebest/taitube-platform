import { createRetryPolicy } from '../retry-policy';

const transient = createRetryPolicy({ classify: () => 'transient' });
const permanent = createRetryPolicy({ classify: () => 'permanent' });

describe('@kit/query: createRetryPolicy', () => {
  it('never retries a permanent failure', () => {
    expect(permanent.shouldRetry(0, new Error('x'))).toBe(false);
  });

  it.each([
    { failureCount: 0, retried: true },
    { failureCount: 2, retried: true },
    { failureCount: 3, retried: false },
  ])(
    'retries a transient failure after $failureCount failures: $retried',
    ({ failureCount, retried }) => {
      expect(transient.shouldRetry(failureCount, new Error('x'))).toBe(retried);
    }
  );

  it('hands the failure to the classifier', () => {
    const classify = vi.fn(() => 'transient' as const);
    const error = new Error('x');

    createRetryPolicy({ classify }).shouldRetry(0, error);

    expect(classify).toHaveBeenCalledWith(error);
  });

  it.each([
    { failureCount: 0, random: 1, expected: 1000 },
    { failureCount: 2, random: 1, expected: 4000 },
    { failureCount: 2, random: 0.5, expected: 2000 },
    { failureCount: 10, random: 1, expected: 30_000 },
    { failureCount: 3, random: 0, expected: 0 },
  ])(
    'backs off $expected ms after $failureCount failures at jitter $random',
    ({ failureCount, random, expected }) => {
      expect(transient.retryDelay(failureCount, new Error('x'), () => random)).toBe(expected);
    }
  );

  it('waits as long as the failure says, and backs off when it says nothing', () => {
    const policy = createRetryPolicy({
      classify: () => 'transient',
      retryAfterMs: (error) => (error instanceof RangeError ? 12_000 : undefined),
    });

    expect(policy.retryDelay(0, new RangeError('x'), () => 0)).toBe(12_000);
    expect(policy.retryDelay(1, new Error('x'), () => 1)).toBe(2000);
  });
});
