import { runTwice } from '../../__tests__/fake-seed';
import { channels } from '../channels';

describe('seed/scenarios: channels', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(channels);

    expect(first).toMatchObject({ scenario: 'channels', status: 'done' });
    expect(first?.detail).toMatch(/^8 channel profiles created/);
    expect(second).toMatchObject({ scenario: 'channels', status: 'done' });
    expect(second?.detail).toMatch(/^0 channel profiles created, 8 already there/);
  });
});
