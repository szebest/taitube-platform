import { Histogram, type Registry } from 'prom-client';

/** Real-user Core Web Vitals from the client apps, by app and TanStack Router route id. */
export interface WebVitalsMetrics {
  frontendLcp: Histogram<string>;
  frontendInp: Histogram<string>;
  frontendCls: Histogram<string>;
  frontendFcp: Histogram<string>;
  frontendTtfb: Histogram<string>;
}

const LABEL_NAMES = ['app', 'route'];

/** Each set of buckets brackets the metric's own good and poor thresholds from web.dev. */
export function createWebVitalsMetrics(registry: Registry): WebVitalsMetrics {
  const frontendLcp = new Histogram({
    name: 'frontend_lcp_seconds',
    help: 'Largest Contentful Paint reported by the browser, in seconds',
    labelNames: LABEL_NAMES,
    buckets: [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10, 20],
    registers: [registry],
  });

  const frontendInp = new Histogram({
    name: 'frontend_inp_seconds',
    help: 'Interaction to Next Paint reported by the browser, in seconds',
    labelNames: LABEL_NAMES,
    buckets: [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.75, 1, 2],
    registers: [registry],
  });

  const frontendCls = new Histogram({
    name: 'frontend_cls_ratio',
    help: 'Cumulative Layout Shift score reported by the browser',
    labelNames: LABEL_NAMES,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.15, 0.25, 0.5, 1],
    registers: [registry],
  });

  const frontendFcp = new Histogram({
    name: 'frontend_fcp_seconds',
    help: 'First Contentful Paint reported by the browser, in seconds',
    labelNames: LABEL_NAMES,
    buckets: [0.5, 1, 1.5, 1.8, 2.5, 3, 4, 6, 10],
    registers: [registry],
  });

  const frontendTtfb = new Histogram({
    name: 'frontend_ttfb_seconds',
    help: 'Time to First Byte of the document reported by the browser, in seconds',
    labelNames: LABEL_NAMES,
    buckets: [0.1, 0.2, 0.4, 0.8, 1.2, 1.8, 3, 5],
    registers: [registry],
  });

  return { frontendLcp, frontendInp, frontendCls, frontendFcp, frontendTtfb };
}
