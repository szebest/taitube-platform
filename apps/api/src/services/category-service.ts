import { CaslAuthorizationAdapter, type CategoryCacheService } from '@vp/adapters';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@vp/core/domain';
import type { AuthorizationPort } from '@vp/core/ports';
import type { CategoryRepositoryPort } from '@vp/core/repositories';
import type { AuthUser } from '../plugins/auth';
import { assertAdminAccess } from './admin-access';
import { HttpCacheService } from './http-cache-service';

export interface CategoryServiceDeps {
  categories: CategoryRepositoryPort;
  categoryCacheService: CategoryCacheService;
  httpCacheService?: HttpCacheService;
  authorization?: AuthorizationPort;
}

const CATEGORIES_MAX_AGE_SECONDS = 300;
const CATEGORIES_STALE_WHILE_REVALIDATE_SECONDS = 60;

export interface ListCategoriesResult {
  categories: Category[];
  headers: Record<string, string>;
  notModified: boolean;
}

/**
 * CategoryService — Domain service managing taxonomy category lifecycles, caching, and cache invalidation.
 */
export class CategoryService {
  private readonly categories: CategoryRepositoryPort;
  private readonly categoryCacheService: CategoryCacheService;
  private readonly httpCacheService: HttpCacheService;
  private readonly auth: AuthorizationPort;

  constructor(deps: CategoryServiceDeps) {
    this.categories = deps.categories;
    this.categoryCacheService = deps.categoryCacheService;
    this.httpCacheService = deps.httpCacheService ?? new HttpCacheService();
    this.auth = deps.authorization ?? new CaslAuthorizationAdapter();
  }

  /**
   * Retrieves active categories using L1/L2 multi-tier caching and evaluates HTTP conditional ETag.
   */
  async listActive(ifNoneMatch?: string): Promise<ListCategoriesResult> {
    const categories = await this.categoryCacheService.getCategories(() =>
      this.categories.findAll({ activeOnly: true })
    );

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
  }

  /**
   * Creates a category and invalidates L1/L2 multi-tier caches across all pods.
   */
  async create(caller: AuthUser | null, input: CreateCategoryInput): Promise<Category> {
    assertAdminAccess(this.auth, caller);
    const created = await this.categories.create(input);
    await this.categoryCacheService.invalidate();
    return created;
  }

  /**
   * Updates an existing category and invalidates L1/L2 multi-tier caches across all pods.
   */
  async update(caller: AuthUser | null, id: string, input: UpdateCategoryInput): Promise<Category> {
    assertAdminAccess(this.auth, caller);
    const updated = await this.categories.update(id, input);
    await this.categoryCacheService.invalidate();
    return updated;
  }

  /**
   * Deletes an unused category and invalidates L1/L2 multi-tier caches across all pods.
   */
  async delete(caller: AuthUser | null, id: string): Promise<void> {
    assertAdminAccess(this.auth, caller);
    await this.categories.delete(id);
    await this.categoryCacheService.invalidate();
  }
}
