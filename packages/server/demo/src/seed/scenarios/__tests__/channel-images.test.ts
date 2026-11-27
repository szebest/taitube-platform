import { runTwice } from '../../__tests__/fake-seed';
import { channelImages } from '../channel-images';

describe('seed/scenarios: channel-images', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(channelImages);

    expect(first).toMatchObject({ scenario: 'channel-images', status: 'done' });
    expect(first?.detail).toMatch(/^6 channel images created/);
    expect(second).toMatchObject({ scenario: 'channel-images', status: 'done' });
    expect(second?.detail).toMatch(/^0 channel images created, 6 already there/);
  });
});
