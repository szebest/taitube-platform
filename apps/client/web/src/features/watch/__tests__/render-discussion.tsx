import { waitFor } from '@testing-library/react';
import type { Account, ChannelMembershipView, Video } from '@vp/api-contracts';
import type { HttpHandler } from 'msw/http';
import { RecordingObserver } from '#app/__tests__/recording-observer';
import { renderWatch } from '#app/__tests__/render-watch';

interface DiscussionOptions {
  viewer?: Account;
  memberships?: ChannelMembershipView[];
  video?: Partial<Video>;
  handlers: HttpHandler[];
}

const THREAD_SKELETON = '[data-slot="comment-thread-skeleton"]';

/** The first comments request and the thread's first render, cold under load, outlast a spec's own 1 s wait. */
const THREAD_TIMEOUT_MS = 10_000;

/** The watch page with the discussion's section scrolled to, so its query runs, once the thread has loaded. */
export async function renderDiscussion({
  viewer,
  memberships,
  video,
  handlers,
}: DiscussionOptions) {
  RecordingObserver.install();
  const rendered = await renderWatch({ viewer, memberships, video, handlers });
  RecordingObserver.enterView();
  await waitFor(() => expect(document.querySelector(THREAD_SKELETON)).toBeNull(), {
    timeout: THREAD_TIMEOUT_MS,
  });
  return rendered;
}
