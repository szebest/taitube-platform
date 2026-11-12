import { runTwice } from '../../__tests__/fake-seed';
import { categories } from '../categories';

describe('seed/scenarios: categories', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(categories);

    expect(first).toMatchObject({ scenario: 'categories', status: 'done' });
    expect(first?.detail).toMatch(/^9 categories created/);
    expect(second).toMatchObject({ scenario: 'categories', status: 'done' });
    expect(second?.detail).toMatch(/^0 categories created, 9 already there/);
  });
});
