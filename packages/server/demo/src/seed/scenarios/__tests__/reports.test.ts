import { runTwice } from '../../__tests__/fake-seed';
import { reports } from '../reports';

describe('seed/scenarios: reports', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(reports);

    expect(first).toMatchObject({ scenario: 'reports', status: 'done' });
    expect(first?.detail).toMatch(/^(\d+) comment reports created/);
    expect(second).toMatchObject({ scenario: 'reports', status: 'done' });
    expect(second?.detail).toMatch(/^0 comment reports created, \d+ already there/);
  });
});
