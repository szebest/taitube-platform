import {
  type ChannelAnalytics,
  getChannelAnalytics,
  getVideoAnalytics,
  getVideoRetention,
  type VideoRetention,
} from '@vp/api-contracts';
import { apiServer, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

const SECONDS_PER_VIEW = 90;

export const dailyViews = (views: readonly number[]) =>
  views.map((count, index) => ({
    viewDate: `2026-10-${String(index + 1).padStart(2, '0')}`,
    views: count,
    watchSeconds: count * SECONDS_PER_VIEW,
  }));

const channelAnalytics = (views: readonly number[]): ChannelAnalytics => ({
  totalViews: 9000,
  videoCount: 3,
  dailyVelocity: 1,
  topVideos: [],
  range: '30d',
  from: '2026-10-01',
  to: `2026-10-${String(views.length).padStart(2, '0')}`,
  timeline: dailyViews(views),
  rangeViews: views.reduce((sum, count) => sum + count, 0),
});

const retentionCurve = (viewers: readonly number[]): VideoRetention => ({
  videoId: VIDEO_ID,
  curve: viewers.map((count, index) => ({ percent: index * 5, viewers: count })),
});

interface AnalyticsFixture {
  views?: readonly number[];
  retention?: readonly number[];
}

/** The creator analytics endpoints; the `range` of each request they saw comes back for assertions. */
export function analyticsHandlers({
  views = [10, 20, 30],
  retention = [100, 80, 40],
}: AnalyticsFixture = {}) {
  const requests: { scope: 'channel' | 'video'; range: string | null }[] = [];
  const rangeOf = (request: Request) => new URL(request.url).searchParams.get('range');
  const handlers = [
    mockEndpoint(getChannelAnalytics, ({ request }) => {
      requests.push({ scope: 'channel', range: rangeOf(request) });
      return HttpResponse.json(channelAnalytics(views));
    }),
    mockEndpoint(getVideoAnalytics, ({ request }) => {
      requests.push({ scope: 'video', range: rangeOf(request) });
      return HttpResponse.json({
        ...channelAnalytics(views),
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
