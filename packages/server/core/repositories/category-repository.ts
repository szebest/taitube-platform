import type {
  Category,
  CreateCategoryInput,
  ListCategoriesOptions,
  UpdateCategoryInput,
} from '@vp/domain';
import type { CategorySlugConflict, DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * Absence is not a failure: `findById`, `findBySlug` and `update` answer `ok(null)` for a row that
 * is not there. Whether a missing category is an error is a domain decision and belongs to the rule
 * that asks, not to the store that looked.
 */
export interface CategoryRepositoryPort {
  findAll(options?: ListCategoriesOptions): Promise<Result<Category[], DatabaseUnavailable>>;
  findById(id: string): Promise<Result<Category | null, DatabaseUnavailable>>;
  findBySlug(slug: string): Promise<Result<Category | null, DatabaseUnavailable>>;
  create(
    input: CreateCategoryInput
  ): Promise<Result<Category, DatabaseUnavailable | CategorySlugConflict>>;
  update(
    id: string,
    input: UpdateCategoryInput
  ): Promise<Result<Category | null, DatabaseUnavailable | CategorySlugConflict>>;
  delete(id: string): Promise<Result<void, DatabaseUnavailable>>;
  countVideos(categoryId: string): Promise<Result<number, DatabaseUnavailable>>;
}
