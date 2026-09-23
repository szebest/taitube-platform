import type { CategoryRepositoryPort } from '@vp/core/repositories';
import type {
  Category,
  CreateCategoryInput,
  ListCategoriesOptions,
  UpdateCategoryInput,
} from '@vp/domain';
import {
  type CategorySlugConflict,
  type DatabaseUnavailable,
  categorySlugConflict,
} from '@vp/errors';
import { type Result, err, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

export interface InMemoryCategoryRepositoryOptions {
  videosRepo?: InMemoryVideoRepository;
}

/**
 * Reports the same failures as the Postgres adapter, including the slug conflict a unique index
 * produces. It decides nothing else: whether a missing category is an error belongs to the rule.
 */
export class InMemoryCategoryRepository implements CategoryRepositoryPort {
  private readonly categories = new Map<string, Category>();
  private videosRepo?: InMemoryVideoRepository;

  constructor(options?: InMemoryCategoryRepositoryOptions) {
    this.videosRepo = options?.videosRepo;
  }

  setVideosRepo(videosRepo: InMemoryVideoRepository): void {
    this.videosRepo = videosRepo;
  }

  clear(): void {
    this.categories.clear();
  }

  private bySlug(slug: string): Category | null {
    for (const category of this.categories.values()) {
      if (category.slug === slug) return category;
    }
    return null;
  }

  async findAll(options?: ListCategoriesOptions): Promise<Result<Category[], DatabaseUnavailable>> {
    const all = Array.from(this.categories.values()).filter(
      (category) => !options?.activeOnly || category.isActive
    );

    return ok(
      all.sort((a, b) =>
        a.sortOrder === b.sortOrder ? a.name.localeCompare(b.name) : a.sortOrder - b.sortOrder
      )
    );
  }

  async findById(id: string): Promise<Result<Category | null, DatabaseUnavailable>> {
    return ok(this.categories.get(id) ?? null);
  }

  async findBySlug(slug: string): Promise<Result<Category | null, DatabaseUnavailable>> {
    return ok(this.bySlug(slug));
  }

  async create(
    input: CreateCategoryInput
  ): Promise<Result<Category, DatabaseUnavailable | CategorySlugConflict>> {
    if (this.bySlug(input.slug)) return err(categorySlugConflict(input.slug));

    const now = new Date();
    const category: Category = {
      id: input.id ?? uuidv7(),
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      iconUrl: input.iconUrl ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.categories.set(category.id, category);
    return ok(category);
  }

  async update(
    id: string,
    input: UpdateCategoryInput
  ): Promise<Result<Category | null, DatabaseUnavailable | CategorySlugConflict>> {
    const existing = this.categories.get(id);
    if (!existing) return ok(null);

    if (input.slug && input.slug !== existing.slug) {
      const owner = this.bySlug(input.slug);
      if (owner && owner.id !== id) return err(categorySlugConflict(input.slug));
    }

    const updated: Category = {
      ...existing,
      slug: input.slug ?? existing.slug,
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      iconUrl: input.iconUrl !== undefined ? input.iconUrl : existing.iconUrl,
      sortOrder: input.sortOrder !== undefined ? input.sortOrder : existing.sortOrder,
      isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      updatedAt: new Date(),
    };

    this.categories.set(id, updated);
    return ok(updated);
  }

  async delete(id: string): Promise<Result<void, DatabaseUnavailable>> {
    this.categories.delete(id);
    return ok();
  }

  async countVideos(categoryId: string): Promise<Result<number, DatabaseUnavailable>> {
    return ok(this.videosRepo ? await this.videosRepo.countByCategoryId(categoryId) : 0);
  }
}
