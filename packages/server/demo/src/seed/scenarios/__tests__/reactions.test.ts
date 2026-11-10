import { runTwice } from '../../__tests__/fake-seed';
import { reactions } from '../reactions';

describe('seed/scenarios: reactions', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(reactions);

    expect(first).toMatchObject({ scenario: 'reactions', status: 'done' });
    expect(first?.detail).toMatch(/^(\d+) reactions created/);
    expect(second).toMatchObject({ scenario: 'reactions', status: 'done' });
    expect(second?.detail).toMatch(/^0 reactions created, \d+ already there/);
  });
});
