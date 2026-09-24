import { QUEUES } from '../index';
import { defaultJobOptions, stagePolicies } from '../policies';

describe('job-contracts: retry policies', () => {
  it('gives every queue a stage reads from a policy of its own', () => {
    const stageQueues = QUEUES.filter((queue) => queue !== 'dlq');

    expect(Object.keys(stagePolicies).sort()).toEqual([...stageQueues].sort());
  });

  it.each(Object.entries(stagePolicies))('retries %s more than once, with a delay', (_, policy) => {
    expect(policy.attempts).toBeGreaterThan(1);
    expect(policy.backoff.delay).toBeGreaterThan(0);
  });

  it('keeps a failed job longer than a completed one', () => {
    expect(defaultJobOptions.removeOnFail.age).toBeGreaterThan(
      defaultJobOptions.removeOnComplete.age
    );
  });
});
