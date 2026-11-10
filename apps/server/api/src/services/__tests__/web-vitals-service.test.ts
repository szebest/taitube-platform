import type { WebVital, WebVitalsBatch } from '@vp/api-contracts';
import { type PipelineMetrics, createMetricsRegistry } from '@vp/observability';
import { expectOk } from '@vp/testing/result';
import { WebVitalsService } from '../web-vitals-service';

const ROUTE = '/watch/$videoId';

describe('WebVitalsService', () => {
  let metrics: PipelineMetrics;
  let service: WebVitalsService;

  const createService = (maxRoutesPerApp = 2) => {
    metrics = createMetricsRegistry();
    service = new WebVitalsService({ metrics, maxRoutesPerApp });
  };

  const record = (vitals: WebVital[], app: WebVitalsBatch['app'] = 'web') =>
    expectOk(service.record({ app, vitals }));

  type Histogram =
    | 'frontendLcp'
    | 'frontendInp'
    | 'frontendFcp'
    | 'frontendTtfb'
    | 'frontendCls'
    | 'frontendLongTasks';

  const sample = async (histogram: Histogram, route = ROUTE, app = 'web') => {
    const { values } = await metrics[histogram].get();
    const labelled = values.filter(
      ({ labels }) => labels.app === app && labels.route === route && labels.le === undefined
    );
    return Object.fromEntries(labelled.map(({ metricName, value }) => [metricName, value]));
  };

  beforeEach(() => createService());

  it.each([
    {
      name: 'LCP',
      value: 2500,
      histogram: 'frontendLcp',
      metric: 'frontend_lcp_seconds',
      observed: 2.5,
    },
    {
      name: 'INP',
      value: 120,
      histogram: 'frontendInp',
      metric: 'frontend_inp_seconds',
      observed: 0.12,
    },
    {
      name: 'FCP',
      value: 900,
      histogram: 'frontendFcp',
      metric: 'frontend_fcp_seconds',
      observed: 0.9,
    },
    {
      name: 'TTFB',
      value: 300,
      histogram: 'frontendTtfb',
      metric: 'frontend_ttfb_seconds',
      observed: 0.3,
    },
    {
      name: 'CLS',
      value: 0.07,
      histogram: 'frontendCls',
      metric: 'frontend_cls_ratio',
      observed: 0.07,
    },
    {
      name: 'LONG_TASKS',
      value: 428,
      histogram: 'frontendLongTasks',
      metric: 'frontend_long_tasks_seconds',
      observed: 0.428,
    },
  ] as const)(
    'records $name into $metric as $observed',
    async ({ name, value, histogram, metric, observed }) => {
      record([{ name, value, route: ROUTE }]);

      expect(await sample(histogram)).toEqual({
        [`${metric}_count`]: 1,
        [`${metric}_sum`]: observed,
      });
    }
  );

  it('labels each vital with the app that sent it', async () => {
    record([{ name: 'LCP', value: 1000, route: ROUTE }], 'studio');

    expect(await sample('frontendLcp', ROUTE, 'studio')).toMatchObject({
      frontend_lcp_seconds_count: 1,
    });
    expect(await sample('frontendLcp', ROUTE, 'web')).toEqual({});
  });

  it('counts route ids past the per-app limit under "other", and keeps the ones it already has', async () => {
    record([
      { name: 'LCP', value: 1000, route: '/' },
      { name: 'LCP', value: 1000, route: ROUTE },
      { name: 'LCP', value: 1000, route: '/c/$channelId' },
      { name: 'LCP', value: 1000, route: '/' },
    ]);
    record([{ name: 'LCP', value: 1000, route: '/c/$channelId' }], 'studio');

    expect(await sample('frontendLcp', '/')).toMatchObject({
      frontend_lcp_seconds_count: 2,
    });
    expect(await sample('frontendLcp', '/c/$channelId')).toEqual({});
    expect(await sample('frontendLcp', 'other')).toMatchObject({
      frontend_lcp_seconds_count: 1,
    });
    expect(await sample('frontendLcp', '/c/$channelId', 'studio')).toMatchObject({
      frontend_lcp_seconds_count: 1,
    });
  });

  describe('the layout shift source', () => {
    const sources = async () => {
      const { values } = await metrics.frontendLayoutShiftSources.get();
      return Object.fromEntries(values.map(({ labels, value }) => [labels.source, value]));
    };

    it('counts the slot a CLS vital names, and ignores one on any other vital', async () => {
      record([
        { name: 'CLS', value: 0.09, route: ROUTE, source: 'app-shell-main' },
        { name: 'CLS', value: 0.2, route: ROUTE, source: 'app-shell-main' },
        { name: 'CLS', value: 0.01, route: ROUTE },
        { name: 'LCP', value: 900, route: ROUTE, source: 'video-card' },
      ]);

      expect(await sources()).toEqual({ 'app-shell-main': 2 });
    });

    it('counts slots past the per-app limit under "other"', async () => {
      record([
        { name: 'CLS', value: 0.09, route: ROUTE, source: 'a' },
        { name: 'CLS', value: 0.09, route: ROUTE, source: 'b' },
        { name: 'CLS', value: 0.09, route: ROUTE, source: 'c' },
      ]);

      expect(await sources()).toEqual({ a: 1, b: 1, other: 1 });
    });
  });
});
