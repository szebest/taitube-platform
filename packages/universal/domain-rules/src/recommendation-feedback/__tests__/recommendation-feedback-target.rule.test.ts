import type { FeedbackTarget, Video } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { aChannel, aVideo, OWNER, STRANGER } from '../../__tests__/entities';
import { decideRecommendationFeedbackTarget } from '../recommendation-feedback-target.rule';

const VIDEO_TARGET: FeedbackTarget = { kind: 'not_interested', videoId: 'v1' };
const CHANNEL_TARGET: FeedbackTarget = { kind: 'hide_channel', channelId: 'c1' };

describe('@vp/domain-rules: decideRecommendationFeedbackTarget', () => {
  it.each<{ scenario: string; target: FeedbackTarget; video: Video | null }>([
    { scenario: 'a public video', target: VIDEO_TARGET, video: aVideo({ id: 'v1' }) },
    { scenario: 'an existing channel', target: CHANNEL_TARGET, video: null },
  ])('accepts $scenario', ({ target, video }) => {
    const channel = aChannel({ id: 'c1' });

    expect(
      expectOk(decideRecommendationFeedbackTarget({ viewer: STRANGER, target, video, channel }))
    ).toBe(target);
  });

  it.each([
    { scenario: 'an unknown video', video: null },
    {
      scenario: 'a private video of someone else',
      video: aVideo({ id: 'v1', visibility: 'private' }),
    },
  ])('answers $scenario with VIDEO_NOT_FOUND', ({ video }) => {
    expect(
      expectErr(
        decideRecommendationFeedbackTarget({
          viewer: STRANGER,
          target: VIDEO_TARGET,
          video,
          channel: null,
        })
      )
    ).toMatchObject({ code: ErrorCodes.VIDEO_NOT_FOUND, videoId: 'v1' });
  });

  it('lets the owner mark their own private video', () => {
    const video = aVideo({ id: 'v1', visibility: 'private' });

    expectOk(
      decideRecommendationFeedbackTarget({
        viewer: OWNER,
        target: VIDEO_TARGET,
        video,
        channel: null,
      })
    );
  });

  it('answers an unknown channel with CHANNEL_NOT_FOUND', () => {
    expect(
      expectErr(
        decideRecommendationFeedbackTarget({
          viewer: STRANGER,
          target: CHANNEL_TARGET,
          video: null,
          channel: null,
        })
      )
    ).toMatchObject({ code: ErrorCodes.CHANNEL_NOT_FOUND, idOrHandle: 'c1' });
  });
});
