import type { CategoryCacheService } from '@vp/adapters';
import type {
  Category,
  CategoryRepositoryPort,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@vp/core/ports';
import { HttpCacheService } from './http-cache-service';

export interface CategoryServiceDeps {
  categories: CategoryRepositoryPort;
  categoryCacheService: CategoryCacheService;
  httpCacheService?: HttpCacheService;
}

export interface ListCategoriesResult {
  categories: Category[];
  etag: string;
  isNotModified: boolean;
}

/**
 * CategoryService — Domain service managing taxonomy category lifecycles, caching, and cache invalidation.
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
   * Retrieves active categories using L1/L2 multi-tier caching and evaluates HTTP conditional ETag.
   */
  async listActive(ifNoneMatch?: string): Promise<ListCategoriesResult> {
    const { categories, etag } = await this.categoryCacheService.getCategories(() =>
      this.categories.findAll({ activeOnly: true })
    );

    const isNotModified = this.httpCacheService.isNotModified(ifNoneMatch, etag);

    return { categories, etag, isNotModified };
  }

  /**
   * Creates a category and invalidates L1/L2 multi-tier caches across all pods.
   */
  async create(input: CreateCategoryInput): Promise<Category> {
    const created = await this.categories.create(input);
    await this.categoryCacheService.invalidate();
    return created;
  }

  /**
   * Updates an existing category and invalidates L1/L2 multi-tier caches across all pods.
   */
  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const updated = await this.categories.update(id, input);
    await this.categoryCacheService.invalidate();
    return updated;
  }

  /**
   * Deletes an unused category and invalidates L1/L2 multi-tier caches across all pods.
   */
  async delete(id: string): Promise<void> {
    await this.categories.delete(id);
    await this.categoryCacheService.invalidate();
  }
}
