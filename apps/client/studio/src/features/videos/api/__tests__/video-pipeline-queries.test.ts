import { QueryObserver } from '@tanstack/react-query';
import { createQueryClient, videoKeys } from '@vp/queries';
import { VIDEO_ID, api, video } from '@vp/web-testing';
import {
  generationsOf,
  servePipeline,
  suggestion,
} from '#app/features/videos/__tests__/video-pipeline-api.fixture';
import {
  clipSuggestionsQueryOptions,
  generationInFlight,
  generationsQueryOptions,
} from '../video-pipeline-queries';

const rendering = {
  generation: 2,
  kind: 'edit' as const,
  status: 'rendering' as const,
  durationMs: null,
  needsReview: false,
  errorCode: null,
  purgeAfter: null,
  createdAt: '2026-03-01T12:00:00.000Z',
};

describe('apps/client/studio: video pipeline queries', () => {
  it.each([
    { key: generationsQueryOptions(api, VIDEO_ID).queryKey },
    { key: clipSuggestionsQueryOptions(api, VIDEO_ID).queryKey },
  ])('keeps $key under the video, so a swap announced on the stream refreshes it', ({ key }) => {
    expect(key.slice(0, videoKeys.detail(VIDEO_ID).length)).toEqual(videoKeys.detail(VIDEO_ID));
  });

  it.each([
    { shape: 'nothing in flight', items: [], inFlight: false },
    { shape: 'a render in flight', items: [rendering], inFlight: true },
    {
      shape: 'a failed render',
      items: [{ ...rendering, status: 'failed' as const }],
      inFlight: false,
    },
  ])('tells $shape apart: $inFlight', ({ items, inFlight }) => {
    expect(generationInFlight(generationsOf({ items }))).toBe(inFlight);
  });

  it('reads the generations of the video', async () => {
    servePipeline(video(), { generations: generationsOf({ items: [rendering] }) });

    const result = await new QueryObserver(
      createQueryClient(),
      generationsQueryOptions(api, VIDEO_ID)
    ).refetch();

    expect(result.data?.items).toEqual([rendering]);
  });

  it('reads the clip suggestions of the video', async () => {
    servePipeline(video(), { suggestions: [suggestion(30_000)] });
    const client = createQueryClient();

    const result = await new QueryObserver(
      client,
      clipSuggestionsQueryOptions(api, VIDEO_ID)
    ).refetch();

    expect(result.data?.items).toEqual([suggestion(30_000)]);
  });
});
