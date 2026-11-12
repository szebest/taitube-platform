import { runTwice } from '../../__tests__/fake-seed';
import { history } from '../history';

describe('seed/scenarios: history', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(history);

    expect(first).toMatchObject({ scenario: 'history', status: 'done' });
    expect(first?.detail).toMatch(/^(\d+) watch history entries created/);
    expect(second).toMatchObject({ scenario: 'history', status: 'done' });
    expect(second?.detail).toMatch(/^0 watch history entries created, \d+ already there/);
  });
});
