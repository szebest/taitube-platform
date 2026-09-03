export interface TracingConfig {
  serviceName: string;
  enabled?: boolean;
}

export interface TracingContext {
  traceparent?: string;
  spanId?: string;
  traceId?: string;
}

/**
 * Lightweight / no-op OpenTelemetry bootstrap for Node and Bun runtimes.
 * Safe across both runtimes without crashing Bun (SDD §2.3, ADR-01).
 * Full OTel exporter integration lands in Ticket 23.
 */
export function initTracing(config: TracingConfig): void {
  const isEnabled = config.enabled ?? process.env.OTEL_ENABLED === 'true';
  if (!isEnabled) {
    return;
  }
  // No-op placeholder: avoids loading Node-specific native C++ modules under Bun
}
