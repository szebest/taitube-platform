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
});
