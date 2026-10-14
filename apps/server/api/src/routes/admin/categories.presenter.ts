import { type Problem, problemFor } from '@vp/api-contracts';
import { assertNever } from '@vp/result';
import type {
  CreateCategoryServiceFailure,
  DeleteCategoryServiceFailure,
  UpdateCategoryServiceFailure,
} from '../../services/category-service';

export type AdminCategoryFailure =
  | CreateCategoryServiceFailure
  | UpdateCategoryServiceFailure
  | DeleteCategoryServiceFailure;

/**
 * Total over the admin category surface, so adding a variant to any of the three rules stops this
 * file compiling until someone decides what it looks like over HTTP. That is the property, and it
 * is why this is a named module with its own test rather than an inline lambda.
 *
 * It imports no port and holds no business branch: every decision was already made by the rule.
 */
export function presentAdminCategoryFailure(
  failure: AdminCategoryFailure,
  instance: string
): Problem {
  switch (failure.code) {
    case 'CATEGORY_SLUG_CONFLICT':
      return problemFor(failure, instance, {
        errors: [{ field: 'slug', slug: failure.slug }],
      });
    case 'CATEGORY_IN_USE':
      return problemFor(failure, instance, {
        detail: `Reassign or delete the ${failure.videoCount} video(s) using this category first`,
      });
    case 'VALIDATION_FAILED':
    case 'CATEGORY_NOT_FOUND':
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
    case 'DATABASE_UNAVAILABLE':
      return problemFor(failure, instance);
    default:
      return assertNever(failure, 'presentAdminCategoryFailure');
  }
}
