import type { HealthCheckable } from '@vp/core/ports';
import { isOk } from '@vp/result';

type DependencyCheck = 'ok' | 'failed';

export interface ReadinessReport {
  ready: boolean;
  checks: Record<string, DependencyCheck>;
}

/**
 * A draining process answers not-ready before it asks any dependency, so a load balancer stops
 * routing to it while the requests already in flight finish.
 */
export class ReadinessService {
  private draining = false;

  constructor(private readonly dependencies: Readonly<Record<string, HealthCheckable>>) {}

  beginDrain(): void {
    this.draining = true;
  }

  async report(): Promise<ReadinessReport> {
    if (this.draining) return { ready: false, checks: {} };

    const checks: Record<string, DependencyCheck> = {};
    for (const [name, dependency] of Object.entries(this.dependencies)) {
      checks[name] = isOk(await dependency.checkHealth()) ? 'ok' : 'failed';
    }

    return { ready: Object.values(checks).every((check) => check === 'ok'), checks };
  }
}
