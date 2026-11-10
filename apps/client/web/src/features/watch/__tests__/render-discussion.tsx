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

/** The watch page with the discussion's section scrolled to, so its query runs. */
export async function renderDiscussion({
  viewer,
  memberships,
  video,
  handlers,
}: DiscussionOptions) {
  RecordingObserver.install();
  const rendered = await renderWatch({ viewer, memberships, video, handlers });
  RecordingObserver.enterView();
  return rendered;
}
