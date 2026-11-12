import { runTwice } from '../../__tests__/fake-seed';
import { searches } from '../searches';

describe('seed/scenarios: searches', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(searches);

    expect(first).toMatchObject({ scenario: 'searches', status: 'done' });
    expect(first?.detail).toMatch(/^(\d+) searches created/);
    expect(second).toMatchObject({ scenario: 'searches', status: 'done' });
    expect(second?.detail).toMatch(/^0 searches created, \d+ already there/);
  });
});
