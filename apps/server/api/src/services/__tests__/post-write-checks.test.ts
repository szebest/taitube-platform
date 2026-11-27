import { expectErr, expectOk } from '@kit/testing/result';
import type { PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { checkPayloadReferences } from '../post-write-checks';
import { NOW, postsFixture } from './post-deps';

const DAY = 86_400_000;

describe('apps/server/api/services: checkPayloadReferences', () => {
  it('accepts a text, a poll with no close time and images that are ready', async () => {
    const { channel, readyImage, repositories } = await postsFixture();
    const images: PostPayload = {
      kind: 'images',
      images: [{ uploadId: await readyImage(), alt: 'a' }],
      caption: null,
    };
    const poll: PostPayload = { kind: 'poll', question: 'q', options: ['a', 'b'], closesAt: null };
    const check = async (payload: PostPayload) =>
      checkPayloadReferences({ images: repositories.channelImages }, channel.id, payload, {
        at: new Date(NOW),
        previous: null,
      });

    expectOk(await check({ kind: 'text', text: 'x' }));
    expectOk(await check(poll));
    expectOk(await check(images));
  });

  it.each([
    { scenario: 'a close time in the past', days: -1, code: ErrorCodes.VALIDATION_FAILED },
    { scenario: 'a close time past 30 days', days: 31, code: ErrorCodes.VALIDATION_FAILED },
  ])('refuses $scenario before reading any image', async ({ days, code }) => {
    const { channel, repositories } = await postsFixture();
    const read = vi.spyOn(repositories.channelImages, 'findReadyPostImages');
    const payload: PostPayload = {
      kind: 'poll',
      question: 'q',
      options: ['a', 'b'],
      closesAt: new Date(NOW + days * DAY).toISOString(),
    };

    const failure = expectErr(
      await checkPayloadReferences({ images: repositories.channelImages }, channel.id, payload, {
        at: new Date(NOW),
        previous: null,
      })
    );

    expect(failure.code).toBe(code);
    expect(read).not.toHaveBeenCalled();
  });

  it('refuses an image that is not ready and names it', async () => {
    const { channel, repositories } = await postsFixture();
    const payload: PostPayload = {
      kind: 'images',
      images: [{ uploadId: '00000000-0000-7000-8000-0000000012aa', alt: 'a' }],
      caption: null,
    };

    const failure = expectErr(
      await checkPayloadReferences({ images: repositories.channelImages }, channel.id, payload, {
        at: new Date(NOW),
        previous: null,
      })
    );

    expect(failure).toMatchObject({
      code: ErrorCodes.POST_IMAGE_NOT_READY,
      uploadId: '00000000-0000-7000-8000-0000000012aa',
    });
  });

  it('leaves the close time of an edited poll alone when it did not change, and holds a new one to the opening', async () => {
    const { channel, repositories } = await postsFixture();
    const closed: PostPayload = {
      kind: 'poll',
      question: 'q',
      options: ['a', 'b'],
      closesAt: new Date(NOW - DAY).toISOString(),
    };
    const check = async (payload: PostPayload, at: Date) =>
      checkPayloadReferences({ images: repositories.channelImages }, channel.id, payload, {
        at,
        previous: closed,
      });

    expectOk(await check({ ...closed, question: 'reworded' }, new Date(NOW)));
    expect(
      expectErr(
        await check(
          { ...closed, closesAt: new Date(NOW + DAY).toISOString() },
          new Date(NOW + 2 * DAY)
        )
      ).code
    ).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});
