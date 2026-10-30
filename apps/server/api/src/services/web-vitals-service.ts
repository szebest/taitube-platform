import type { TelemetryApp, WebVital, WebVitalsBatch } from '@vp/api-contracts';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, ok } from '@vp/result';

export interface WebVitalsServiceDeps {
  metrics: PipelineMetrics;
  maxRoutesPerApp: number;
}

/** The label a route id past `maxRoutesPerApp` is recorded under. */
const OVERFLOW_ROUTE = 'other';

type VitalHistogram =
  | 'frontendLcp'
  | 'frontendInp'
  | 'frontendCls'
  | 'frontendFcp'
  | 'frontendTtfb';

/** Each vital's histogram, and the divisor that turns the browser's value into the histogram's unit. */
const HISTOGRAMS: Readonly<Record<WebVital['name'], { field: VitalHistogram; divisor: number }>> = {
  LCP: { field: 'frontendLcp', divisor: MS_PER_SECOND },
  INP: { field: 'frontendInp', divisor: MS_PER_SECOND },
  FCP: { field: 'frontendFcp', divisor: MS_PER_SECOND },
  TTFB: { field: 'frontendTtfb', divisor: MS_PER_SECOND },
  CLS: { field: 'frontendCls', divisor: 1 },
};

/**
 * Turns browser-reported vitals into histogram observations. The contract bounds each route id; the
 * per-app cap bounds how many there are, so a client cannot grow the series without limit.
 */
export class WebVitalsService {
  private readonly routes = new Map<TelemetryApp, Set<string>>();

  constructor(private readonly deps: WebVitalsServiceDeps) {}

  record({ app, vitals }: WebVitalsBatch): Result<undefined, never> {
    for (const vital of vitals) {
      this.observe(vital, app, this.routeLabel(app, vital.route));
    }
    return ok(undefined);
  }

  private routeLabel(app: TelemetryApp, route: string): string {
    const known = this.routes.get(app);
    if (known?.has(route)) {
      return route;
    }
    if (known && known.size >= this.deps.maxRoutesPerApp) {
      return OVERFLOW_ROUTE;
    }

    this.routes.set(app, new Set(known).add(route));
    return route;
  }

  private observe({ name, value }: WebVital, app: TelemetryApp, route: string): void {
    const { field, divisor } = HISTOGRAMS[name];
    this.deps.metrics[field].observe({ app, route }, value / divisor);
  }
}
