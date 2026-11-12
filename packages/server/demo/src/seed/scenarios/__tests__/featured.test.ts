import { runTwice } from '../../__tests__/fake-seed';
import { featured } from '../featured';

describe('seed/scenarios: featured', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(featured);

    expect(first).toMatchObject({ scenario: 'featured', status: 'done' });
    expect(first?.detail).toMatch(/^(\d+) shelves and spotlights created/);
    expect(second).toMatchObject({ scenario: 'featured', status: 'done' });
    expect(second?.detail).toMatch(/^0 shelves and spotlights created, \d+ already there/);
  });
});
