import type { TelemetryApp, WebVital, WebVitalsBatch } from '@vp/api-contracts';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, assertNever, ok } from '@vp/result';

export interface WebVitalsServiceDeps {
  metrics: PipelineMetrics;
  maxRoutesPerApp: number;
}

/** The label a route id past `maxRoutesPerApp` is recorded under. */
const OVERFLOW_ROUTE = 'other';

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
    const known = this.routes.get(app) ?? new Set<string>();
    this.routes.set(app, known);
    if (known.has(route)) {
      return route;
    }
    if (known.size >= this.deps.maxRoutesPerApp) {
      return OVERFLOW_ROUTE;
    }

    known.add(route);
    return route;
  }

  private observe({ name, value }: WebVital, app: TelemetryApp, route: string): void {
    const { metrics } = this.deps;
    const labels = { app, route };
    switch (name) {
      case 'LCP':
        metrics.frontendLcp.observe(labels, value / MS_PER_SECOND);
        return;
      case 'INP':
        metrics.frontendInp.observe(labels, value / MS_PER_SECOND);
        return;
      case 'FCP':
        metrics.frontendFcp.observe(labels, value / MS_PER_SECOND);
        return;
      case 'TTFB':
        metrics.frontendTtfb.observe(labels, value / MS_PER_SECOND);
        return;
      case 'CLS':
        metrics.frontendCls.observe(labels, value);
        return;
      default:
        assertNever(name, 'web vital');
    }
  }
}
