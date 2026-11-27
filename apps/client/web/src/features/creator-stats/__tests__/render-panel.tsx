import type { Account, ChannelMembershipView, CreatorStats, Video } from '@vp/api-contracts';
import { getCreatorStats, getVideoRetention } from '@vp/api-contracts';
import { creatorStats, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { renderWatch } from '#app/__tests__/render-watch';

interface PanelOptions {
  viewer?: Account;
  memberships?: ChannelMembershipView[];
  stats?: CreatorStats;
  video?: Partial<Video>;
  handlers?: HttpHandler[];
  /** A viewport under 600 px, where the panel starts collapsed. */
  compact?: boolean;
}

const CURVE = [100, 80, 60, 60, 50, 50, 40, 40, 30, 30, 30, 20, 20, 20, 20, 10, 10, 10, 10, 5, 5];

/** The watch page as `viewer` sees it, with the stats and retention endpoints answering and the paths they were asked for recorded. */
export async function renderPanel({
  viewer,
  memberships,
  stats = creatorStats(),
  video,
  handlers = [],
  compact = false,
}: PanelOptions = {}) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: !compact && query === '(min-width: 600px)',
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList
  );
  const requests: string[] = [];
  const rendered = await renderWatch({
    viewer,
    memberships,
    video,
    handlers: [
      ...handlers,
      mockEndpoint(getCreatorStats, ({ request }) => {
        requests.push(new URL(request.url).pathname);
        return HttpResponse.json(stats);
      }),
      mockEndpoint(getVideoRetention, () =>
        HttpResponse.json({
          videoId: VIDEO_ID,
          curve: CURVE.map((viewers, step) => ({ percent: step * 5, viewers })),
        })
      ),
    ],
  });
  return { ...rendered, requests };
}
