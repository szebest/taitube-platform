import type { TelemetryApp, WebVital, WebVitalsBatch } from '@vp/api-contracts';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, ok } from '@vp/result';

export interface WebVitalsServiceDeps {
  metrics: PipelineMetrics;
  maxRoutesPerApp: number;
}

/** The label a route id or a shift source past `maxRoutesPerApp` is recorded under. */
const OVERFLOW_LABEL = 'other';

type VitalHistogram =
  | 'frontendLcp'
  | 'frontendInp'
  | 'frontendCls'
  | 'frontendFcp'
  | 'frontendTtfb'
  | 'frontendLongTasks';

/** Each vital's histogram, and the divisor that turns the browser's value into the histogram's unit. */
const HISTOGRAMS: Readonly<Record<WebVital['name'], { field: VitalHistogram; divisor: number }>> = {
  LCP: { field: 'frontendLcp', divisor: MS_PER_SECOND },
  INP: { field: 'frontendInp', divisor: MS_PER_SECOND },
  FCP: { field: 'frontendFcp', divisor: MS_PER_SECOND },
  TTFB: { field: 'frontendTtfb', divisor: MS_PER_SECOND },
  CLS: { field: 'frontendCls', divisor: 1 },
  LONG_TASKS: { field: 'frontendLongTasks', divisor: MS_PER_SECOND },
};

/**
 * Turns browser-reported vitals into histogram observations. The contract bounds each route id and
 * shift source; the per-app cap bounds how many there are, so a client cannot grow the series without limit.
 */
export class WebVitalsService {
  private readonly routes = new Map<TelemetryApp, Set<string>>();
  private readonly sources = new Map<TelemetryApp, Set<string>>();

  constructor(private readonly deps: WebVitalsServiceDeps) {}

  record({ app, vitals }: WebVitalsBatch): Result<undefined, never> {
    for (const vital of vitals) {
      const route = this.cappedLabel(this.routes, app, vital.route);
      this.observe(vital, app, route);
      if (vital.name === 'CLS' && vital.source) {
        const source = this.cappedLabel(this.sources, app, vital.source);
        this.deps.metrics.frontendLayoutShiftSources.inc({ app, route, source });
      }
    }
    return ok(undefined);
  }

  private cappedLabel(known: Map<TelemetryApp, Set<string>>, app: TelemetryApp, label: string) {
    const labels = known.get(app);
    if (labels?.has(label)) {
      return label;
    }
    if (labels && labels.size >= this.deps.maxRoutesPerApp) {
      return OVERFLOW_LABEL;
    }

    known.set(app, new Set(labels).add(label));
    return label;
  }

  private observe({ name, value }: WebVital, app: TelemetryApp, route: string): void {
    const { field, divisor } = HISTOGRAMS[name];
    this.deps.metrics[field].observe({ app, route }, value / divisor);
  }
}
