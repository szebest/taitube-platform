import type { UserEvent, Video } from '@vp/api-contracts';
import { VIDEO_ID, video } from '@vp/web-testing';

import { createQueryClient } from '../create-query-client';
import { applyUserEvent } from '../user-event-handlers';
import { videoKeys } from '../video-queries';

type Change = Extract<UserEvent, { type: 'video.processing' }>['payload']['change'];

const PROCESSING = video({
  status: 'PROCESSING',
  progress: { overall: 10, byRendition: { '480p': 20 } },
});

function processing(change: Change): UserEvent {
  return { type: 'video.processing', payload: { videoId: VIDEO_ID, change } };
}

function cacheWith(cached?: Video) {
  const queryClient = createQueryClient();
  if (cached) queryClient.setQueryData(videoKeys.detail(cached.id), cached);
  queryClient.setQueryData(videoKeys.mine(), { pages: [], pageParams: [] });
  return {
    apply: (change: Change) => applyUserEvent(queryClient, processing(change)),
    detail: () => queryClient.getQueryData<Video>(videoKeys.detail(VIDEO_ID)),
    isInvalidated: (queryKey: readonly unknown[]) =>
      queryClient.getQueryState(queryKey)?.isInvalidated,
  };
}

describe('@vp/queries: user event handlers', () => {
  it.each([
    {
      change: { kind: 'status', status: 'READY' } as const,
      patched: { status: 'READY', progress: PROCESSING.progress },
    },
    {
      change: { kind: 'progress', rendition: '720p', percent: 40, overall: 30 } as const,
      patched: {
        status: 'PROCESSING',
        progress: { overall: 30, byRendition: { '480p': 20, '720p': 40 } },
      },
    },
  ])('patches the cached video with a $change.kind change', ({ change, patched }) => {
    const { apply, detail } = cacheWith(PROCESSING);

    apply(change);

    expect(detail()).toMatchObject(patched);
  });

  it('refetches the video and the caller list on a status change, for what the status brought', () => {
    const { apply, isInvalidated } = cacheWith(PROCESSING);

    apply({ kind: 'status', status: 'READY' });

    expect(isInvalidated(videoKeys.detail(VIDEO_ID))).toBe(true);
    expect(isInvalidated(videoKeys.mine())).toBe(true);
  });

  it('leaves a video this tab never loaded out of its cache', () => {
    const { apply, detail } = cacheWith();

    apply({ kind: 'progress', rendition: '720p', percent: 40, overall: 30 });

    expect(detail()).toBeUndefined();
  });

  it.each([
    { cached: 2, refetched: true },
    { cached: 3, refetched: false },
  ])(
    'refetches the preferences saved as version 3 elsewhere over a cached version $cached: $refetched',
    ({ cached, refetched }) => {
      const queryClient = createQueryClient();
      queryClient.setQueryData(['preferences'], { version: cached });

      applyUserEvent(queryClient, {
        type: 'preferences.updated',
        payload: { sections: ['appearance'], version: 3 },
      });

      expect(queryClient.getQueryState(['preferences'])?.isInvalidated).toBe(refetched);
    }
  );

  it('refetches the creator inbox when a comment lands on one of the caller videos', () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['creator', 'comments', { filter: 'all' }], { pages: [] });

    applyUserEvent(queryClient, {
      type: 'comment.created',
      payload: {
        comment: {
          id: '00000000-0000-7000-8000-0000000000c1',
          parentId: null,
          content: 'nice',
          createdAt: '2026-03-01T12:00:00.000Z',
          author: {
            userId: '00000000-0000-7000-8000-0000000000c2',
            handle: 'fan',
            displayName: 'Fan',
          },
        },
        video: { id: VIDEO_ID, title: 'Clip' },
      },
    });

    expect(
      queryClient.getQueryState(['creator', 'comments', { filter: 'all' }])?.isInvalidated
    ).toBe(true);
  });
});
