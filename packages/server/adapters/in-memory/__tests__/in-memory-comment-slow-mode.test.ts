import { expectOk } from '@vp/testing/result';
import { describeCommentSlowModeContract } from '../../__tests__/contract/comment-slow-mode.contract';
import { InMemoryCommentSlowMode } from '../in-memory-comment-slow-mode';

describeCommentSlowModeContract(async () => ({
  slowMode: new InMemoryCommentSlowMode(),
  close: async () => {},
}));

describe('InMemoryCommentSlowMode', () => {
  it('claims again once the clock passes the window, and forgets on clear', async () => {
    let nowMs = 0;
    const slowMode = new InMemoryCommentSlowMode(() => nowMs);
    const claim = async () => expectOk(await slowMode.claim('c', 'u', 5)).type;

    expect([await claim(), await claim()]).toEqual(['claimed', 'refused']);
    nowMs = 5_000;
    expect(await claim()).toBe('claimed');

    slowMode.clear();
    expect(await claim()).toBe('claimed');
  });

  it('answers the seconds left, rounded up', async () => {
    let nowMs = 0;
    const slowMode = new InMemoryCommentSlowMode(() => nowMs);
    expectOk(await slowMode.claim('c', 'u', 10));
    nowMs = 7_200;

    expect(expectOk(await slowMode.claim('c', 'u', 10))).toEqual({
      type: 'refused',
      retryAfterSeconds: 3,
    });
  });
});
