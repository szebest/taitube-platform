import type { Category } from '@vp/domain';
import type { ErrorCodes, Failure } from '@vp/errors';
import { type Result, isErr } from '@vp/result';
import type { CreateCategoryServiceFailure } from '../../category-service';

type CategoryQuarantined = Failure<typeof ErrorCodes.QUOTA_EXCEEDED, { slug: string }>;

declare const decideWithGrownRule: (slug: string) => Result<Category, CategoryQuarantined>;
declare const created: Result<Category, CreateCategoryServiceFailure>;

/**
 * A service composes, so its error union is whatever it composed. Adding a variant to a rule
 * widens the return type without anyone writing it down, which is the property ADR-24 buys and the
 * reason a hand-written union is a defect.
 */
async function createWithGrownRule(
  slug: string
): Promise<Result<Category, CreateCategoryServiceFailure | CategoryQuarantined>> {
  const decided = decideWithGrownRule(slug);
  return isErr(decided) ? decided : created;
}

export async function theWidenedUnionNoLongerFitsTheOldSignature(): Promise<
  Result<Category, CreateCategoryServiceFailure>
> {
  // @ts-expect-error the rule's new variant is inferred into the union and the old one cannot hold it
  return createWithGrownRule('gaming');
}
