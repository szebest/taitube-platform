import { runTwice } from '../../__tests__/fake-seed';
import { media } from '../media';

describe('seed/scenarios: media', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(media);

    expect(first).toMatchObject({ scenario: 'media', status: 'done' });
    expect(first?.detail).toMatch(/^6 clips created, 0 already there/);
    expect(second).toMatchObject({ scenario: 'media', status: 'done' });
    expect(second?.detail).toMatch(/^0 clips created, 6 already there/);
  });
});
