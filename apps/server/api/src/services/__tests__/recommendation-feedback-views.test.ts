import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ChannelCard, RecommendationFeedbackEntry } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import {
  toRecommendationFeedbackItemView,
  toRecommendationFeedbackView,
} from '../recommendation-feedback-views';
import { TEST_CDN, TEST_SPRITE } from './service-deps';

const createdAt = new Date('2026-03-01T12:00:00.000Z');
const CHANNEL: ChannelCard = { id: 'c1', handle: 'h', displayName: 'H', avatarUrl: null };

describe('apps/server/api/services: recommendation feedback views', () => {
  it.each([
    {
      scenario: 'a video',
      feedback: { id: 'f1', kind: 'not_interested', videoId: 'v1', createdAt },
      view: { id: 'f1', kind: 'not_interested', videoId: 'v1', createdAt: createdAt.toISOString() },
    },
    {
      scenario: 'a channel',
      feedback: { id: 'f2', kind: 'hide_channel', channelId: 'c1', createdAt },
      view: { id: 'f2', kind: 'hide_channel', channelId: 'c1', createdAt: createdAt.toISOString() },
    },
  ] as const)('shows $scenario with an ISO timestamp', ({ feedback, view }) => {
    expect(toRecommendationFeedbackView(feedback)).toEqual(view);
  });

  it('shows a hidden channel with its card and a hidden video with its summary', async () => {
    const repositories = new InMemoryRepositories();
    const video = expectOk(
      await repositories.videos.create({
        id: '00000000-0000-7000-8000-00000000f0a1',
        ownerId: 'o1',
        title: 'Clip',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/a.mp4',
      })
    );
    const gone: RecommendationFeedbackEntry = {
      id: 'f1',
      kind: 'not_interested',
      videoId: video.id,
      createdAt,
      video: null,
      channel: null,
    };

    expect(
      toRecommendationFeedbackItemView({ ...gone, video, channel: CHANNEL }, TEST_CDN, TEST_SPRITE)
    ).toMatchObject({
      kind: 'not_interested',
      video: { id: video.id, channel: CHANNEL },
      channel: CHANNEL,
    });
    expect(toRecommendationFeedbackItemView(gone, TEST_CDN, TEST_SPRITE)).toMatchObject({
      video: null,
      channel: null,
    });
    expect(
      toRecommendationFeedbackItemView(
        {
          id: 'f2',
          kind: 'hide_channel',
          channelId: 'c1',
          createdAt,
          video: null,
          channel: CHANNEL,
        },
        TEST_CDN,
        TEST_SPRITE
      )
    ).toEqual({
      id: 'f2',
      kind: 'hide_channel',
      channelId: 'c1',
      createdAt: createdAt.toISOString(),
      channel: CHANNEL,
    });
  });
});
