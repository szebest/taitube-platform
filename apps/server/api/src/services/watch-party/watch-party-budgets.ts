import type {
  BudgetRule,
  GateAdmission,
  WatchPartyBudget,
  WatchPartyGatePort,
} from '@vp/core/ports';
import { type CacheUnavailable, ErrorCodes, type Failure } from '@vp/errors';
import { assertNever, err, isErr, ok, type Result } from '@vp/result';

export type RateLimited = Failure<typeof ErrorCodes.RATE_LIMITED, { retryAfterSeconds: number }>;

/** @internal */
export function rateLimited(retryAfterSeconds: number): RateLimited {
  return { code: ErrorCodes.RATE_LIMITED, message: 'Too many requests', retryAfterSeconds };
}

function admissionResult(admission: GateAdmission): Result<void, RateLimited> {
  switch (admission.type) {
    case 'admitted':
      return ok();
    case 'refused':
      return err(rateLimited(admission.retryAfterSeconds));
    default:
      return assertNever(admission, 'GateAdmission');
  }
}

export async function consumeBudget(
  gate: Pick<WatchPartyGatePort, 'consume'>,
  budget: WatchPartyBudget,
  scope: string,
  rule: BudgetRule
): Promise<Result<void, RateLimited | CacheUnavailable>> {
  const admission = await gate.consume(budget, scope, rule);
  return isErr(admission) ? admission : admissionResult(admission.value);
}
