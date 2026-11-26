import type { Result } from '@kit/result';
import type { InfraFailure } from '@vp/errors';

/**
 * A reachability probe. It answers `ok()` or the narrow unavailability of the port it belongs to,
 * so a readiness route reads the verdict instead of catching one.
 */
export interface HealthCheckable<E extends InfraFailure = InfraFailure> {
  checkHealth(): Promise<Result<void, E>>;
}
