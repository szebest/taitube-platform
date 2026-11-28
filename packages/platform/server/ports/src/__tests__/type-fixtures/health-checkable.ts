import type { CacheUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type { HealthCheckable } from '../../health-checkable';

expectTypeOf<ReturnType<HealthCheckable<CacheUnavailable>['checkHealth']>>().toEqualTypeOf<
  Promise<Result<void, CacheUnavailable>>
>();

// @ts-expect-error the failure of a probe is an infrastructure failure
type _Plain = HealthCheckable<{ readonly code: 'X' }>;
