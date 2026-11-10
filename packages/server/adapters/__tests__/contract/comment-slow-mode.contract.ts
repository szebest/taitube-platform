import { randomUUID } from 'node:crypto';
import type { CommentSlowModePort } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface CommentSlowModeSubject {
  readonly slowMode: CommentSlowModePort;
  close(): Promise<void>;
}

const WINDOW_SECONDS = 30;

export function describeCommentSlowModeContract(
  makeSubject: () => Promise<CommentSlowModeSubject>
) {
  describe('CommentSlowMode contract', () => {
    let subject: CommentSlowModeSubject;
    let channelId: string;
    let authorId: string;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(() => {
      channelId = randomUUID();
      authorId = randomUUID();
    });

    const claim = async (channel = channelId, author = authorId) =>
      expectOk(await subject.slowMode.claim(channel, author, WINDOW_SECONDS));

    it('claims the first comment and refuses the next one inside the window', async () => {
      const first = await claim();
      const second = await claim();

      expect(first).toEqual({ type: 'claimed' });
      expect(second).toMatchObject({ type: 'refused' });
      expect(second.type === 'refused' && second.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(second.type === 'refused' && second.retryAfterSeconds).toBeLessThanOrEqual(
        WINDOW_SECONDS
      );
    });

    it.each([
      { name: 'another author', channel: () => channelId, author: () => randomUUID() },
      { name: 'another channel', channel: () => randomUUID(), author: () => authorId },
    ])('claims for $name while this window is open', async ({ channel, author }) => {
      await claim();

      expect(await claim(channel(), author())).toEqual({ type: 'claimed' });
    });

    it('claims again once the window is released', async () => {
      await claim();
      expectOk(await subject.slowMode.release(channelId, authorId));

      expect(await claim()).toEqual({ type: 'claimed' });
    });
  });
}
