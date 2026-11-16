import { runTwice } from '../../__tests__/fake-seed';
import { comments } from '../comments';

describe('seed/scenarios: comments', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(comments);

    expect(first).toMatchObject({ scenario: 'comments', status: 'done' });
    expect(first?.detail).toMatch(
      /^(\d+) comments, replies, pins and hearts created, 0 already there/
    );
    expect(second).toMatchObject({ scenario: 'comments', status: 'done' });
    expect(second?.detail).toMatch(
      /^0 comments, replies, pins and hearts created, \d+ already there/
    );
  });
});
