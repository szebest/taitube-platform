import { runTwice } from '../../__tests__/fake-seed';
import { playlists } from '../playlists';

describe('seed/scenarios: playlists', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(playlists);

    expect(first).toMatchObject({ scenario: 'playlists', status: 'done' });
    expect(first?.detail).toMatch(/^(\d+) playlists and items created/);
    expect(second).toMatchObject({ scenario: 'playlists', status: 'done' });
    expect(second?.detail).toMatch(/^0 playlists and items created, \d+ already there/);
  });
});
