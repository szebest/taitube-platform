import { runTwice } from '../../__tests__/fake-seed';
import { subscriptions } from '../subscriptions';

describe('seed/scenarios: subscriptions', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(subscriptions);

    expect(first).toMatchObject({ scenario: 'subscriptions', status: 'done' });
    expect(first?.detail).toMatch(/^(\d+) subscriptions created/);
    expect(second).toMatchObject({ scenario: 'subscriptions', status: 'done' });
    expect(second?.detail).toMatch(/^0 subscriptions created, \d+ already there/);
  });
});
