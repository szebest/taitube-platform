import type { CategoryCacheService } from '@vp/adapters';
import type { CategoryRepositoryPort } from '@vp/core/repositories';
import {
  type CreateCategoryFailure,
  type DeleteCategoryFailure,
  type UpdateCategoryFailure,
  categoryNotFound,
  decideCategoryCreate,
  decideCategoryDelete,
  decideCategoryUpdate,
} from '@vp/domain-rules';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@vp/domain';
import type { CategorySlugConflict, DatabaseUnavailable } from '@vp/errors';
import { type Result, err, isErr, isOk, map, ok } from '@vp/result';
import type { AuthUser } from '../plugins/auth';
import { HttpCacheService } from './http-cache-service';

export interface CategoryServiceDeps {
  categories: CategoryRepositoryPort;
  categoryCacheService: CategoryCacheService;
  httpCacheService?: HttpCacheService;
}

const CATEGORIES_MAX_AGE_SECONDS = 300;
const CATEGORIES_STALE_WHILE_REVALIDATE_SECONDS = 60;

export interface ListCategoriesResult {
  categories: Category[];
  headers: Record<string, string>;
  notModified: boolean;
}

export type CreateCategoryServiceFailure = CreateCategoryFailure | DatabaseUnavailable;
export type UpdateCategoryServiceFailure =
  | UpdateCategoryFailure
  | CategorySlugConflict
  | DatabaseUnavailable;
export type DeleteCategoryServiceFailure = DeleteCategoryFailure | DatabaseUnavailable;

/**
 * Taxonomy lifecycle and caching. It coordinates the repository, the cache and the rules and
 * decides nothing itself: every verdict comes from `@vp/domain-rules`, and every failure is
 * returned rather than thrown.
 */
export class CategoryService {
  private readonly categories: CategoryRepositoryPort;
  private readonly categoryCacheService: CategoryCacheService;
  private readonly httpCacheService: HttpCacheService;

  constructor(deps: CategoryServiceDeps) {
    this.categories = deps.categories;
    this.categoryCacheService = deps.categoryCacheService;
    this.httpCacheService = deps.httpCacheService ?? new HttpCacheService();
  }

  /**
   * `CacheUnavailable` is absent from the return type because the cache service handles it by
   * falling through to the repository. That narrowing is deliberate and now visible.
   */
  async listActive(
    ifNoneMatch?: string
  ): Promise<Result<ListCategoriesResult, DatabaseUnavailable>> {
    const found = await this.categoryCacheService.getCategories(() =>
      this.categories.findAll({ activeOnly: true })
    );

    return map(found, (categories) => {
      const etag = this.httpCacheService.generateEtag(categories);
      return {
        categories,
        notModified: this.httpCacheService.isNotModified(ifNoneMatch, etag),
        headers: this.httpCacheService.buildCacheHeaders({
          etag,
          maxAgeSeconds: CATEGORIES_MAX_AGE_SECONDS,
          staleWhileRevalidateSeconds: CATEGORIES_STALE_WHILE_REVALIDATE_SECONDS,
        }),
      };
    });
  }

  async create(
    caller: AuthUser | null,
    input: CreateCategoryInput
  ): Promise<Result<Category, CreateCategoryServiceFailure>> {
    const slugHeldBy = await this.categories.findBySlug(input.slug);
    if (isErr(slugHeldBy)) return slugHeldBy;

    const decided = decideCategoryCreate({
      actor: caller,
      form: input,
      slugHeldBy: slugHeldBy.value,
    });
    if (isErr(decided)) return decided;

    return await this.invalidatingOnSuccess(this.categories.create(input));
  }

  async update(
    caller: AuthUser | null,
    id: string,
    input: UpdateCategoryInput
  ): Promise<Result<Category, UpdateCategoryServiceFailure>> {
    const existing = await this.categories.findById(id);
    if (isErr(existing)) return existing;

    const decided = decideCategoryUpdate({
      actor: caller,
      category: existing.value,
      categoryId: id,
      patch: input,
    });
    if (isErr(decided)) return decided;

    const updated = await this.invalidatingOnSuccess(this.categories.update(id, input));
    if (isErr(updated)) return updated;

    return updated.value ? ok(updated.value) : err(categoryNotFound(id));
  }

  async delete(
    caller: AuthUser | null,
    id: string
  ): Promise<Result<void, DeleteCategoryServiceFailure>> {
    const existing = await this.categories.findById(id);
    if (isErr(existing)) return existing;

    const videoCount = await this.categories.countVideos(id);
    if (isErr(videoCount)) return videoCount;

    const decided = decideCategoryDelete({
      actor: caller,
      category: existing.value,
      categoryId: id,
      videoCount: videoCount.value,
    });
    if (isErr(decided)) return decided;

    return await this.invalidatingOnSuccess(this.categories.delete(id));
  }

  private async invalidatingOnSuccess<T, E>(
    write: Promise<Result<T, E>>
  ): Promise<Result<T, E>> {
    const settled = await write;
    if (isOk(settled)) await this.categoryCacheService.invalidate();
    return settled;
  }
}
