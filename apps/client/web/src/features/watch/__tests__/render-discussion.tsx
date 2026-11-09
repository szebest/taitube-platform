import type { Account } from '@vp/api-contracts';
import type { HttpHandler } from 'msw/http';
import { RecordingObserver } from '#app/__tests__/recording-observer';
import { renderWatch } from '#app/__tests__/render-watch';

interface DiscussionOptions {
  viewer?: Account;
  handlers: HttpHandler[];
}

/** The watch page with the discussion's section scrolled to, so its query runs. */
export async function renderDiscussion({ viewer, handlers }: DiscussionOptions) {
  RecordingObserver.install();
  const rendered = await renderWatch({ viewer, handlers });
  RecordingObserver.enterView();
  return rendered;
}
