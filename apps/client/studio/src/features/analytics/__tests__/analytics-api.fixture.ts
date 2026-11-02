import {
  type ChannelAnalytics,
  getChannelAnalytics,
  getVideoAnalytics,
  getVideoRetention,
  type VideoRetention,
} from '@vp/api-contracts';
import { HOURLY_WINDOW_HOURS } from '@vp/domain';
import { MS_PER_HOUR } from '@vp/domain/time';
import { apiServer, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

const SECONDS_PER_VIEW = 90;
const FIRST_HOUR = Date.parse('2026-10-02T00:00:00.000Z');

export const dailyViews = (views: readonly number[]) =>
  views.map((count, index) => ({
    viewDate: `2026-10-${String(index + 1).padStart(2, '0')}`,
    views: count,
    watchSeconds: count * SECONDS_PER_VIEW,
  }));

/** The 48 hours oldest first, `views` filling the first of them and zero after. */
export const hourlyViews = (views: readonly number[] = []) =>
  Array.from({ length: HOURLY_WINDOW_HOURS }, (_, index) => ({
    viewHour: new Date(FIRST_HOUR + index * MS_PER_HOUR).toISOString(),
    views: views[index] ?? 0,
  }));

interface PreviousPeriod {
  views: number;
  netSubscribers: number;
}

export const channelAnalytics = ({
  views = [10, 20, 30],
  hourly = [],
  netSubscribers = 0,
  previous = null,
}: AnalyticsFixture = {}): ChannelAnalytics => ({
  totalViews: 9000,
  videoCount: 3,
  dailyVelocity: 1,
  topVideos: [],
  range: '30d',
  from: '2026-10-01',
  to: `2026-10-${String(views.length).padStart(2, '0')}`,
  timeline: dailyViews(views),
  hourly: hourlyViews(hourly),
  rangeViews: views.reduce((sum, count) => sum + count, 0),
  rangeWatchSeconds: views.reduce((sum, count) => sum + count * SECONDS_PER_VIEW, 0),
  netSubscribers,
  previous:
    previous === null
      ? null
      : {
          rangeViews: previous.views,
          rangeWatchSeconds: previous.views * SECONDS_PER_VIEW,
          netSubscribers: previous.netSubscribers,
        },
});

const retentionCurve = (viewers: readonly number[]): VideoRetention => ({
  videoId: VIDEO_ID,
  curve: viewers.map((count, index) => ({ percent: index * 5, viewers: count })),
});

interface AnalyticsFixture {
  views?: readonly number[];
  hourly?: readonly number[];
  netSubscribers?: number;
  /** The period before the range; `null`, the default, as for lifetime. */
  previous?: PreviousPeriod | null;
  retention?: readonly number[];
}

/** The creator analytics endpoints; the `range` of each request they saw comes back for assertions. */
export function analyticsHandlers({
  retention = [100, 80, 40],
  ...figures
}: AnalyticsFixture = {}) {
  const requests: { scope: 'channel' | 'video'; range: string | null }[] = [];
  const rangeOf = (request: Request) => new URL(request.url).searchParams.get('range');
  const handlers = [
    mockEndpoint(getChannelAnalytics, ({ request }) => {
      requests.push({ scope: 'channel', range: rangeOf(request) });
      return HttpResponse.json(channelAnalytics(figures));
    }),
    mockEndpoint(getVideoAnalytics, ({ request }) => {
      requests.push({ scope: 'video', range: rangeOf(request) });
      return HttpResponse.json({
        ...channelAnalytics(figures),
        videoId: VIDEO_ID,
        totalViews: 500,
        averageDailyViews: 20,
        averageRetention: 0.4,
      });
    }),
    mockEndpoint(getVideoRetention, () => HttpResponse.json(retentionCurve(retention))),
  ];
  return { handlers, requests };
}

export function serveAnalytics(fixture: AnalyticsFixture = {}) {
  const { handlers, requests } = analyticsHandlers(fixture);
  apiServer.use(...handlers);
  return requests;
}
