import type {
  Category,
  CategoryRepositoryPort,
  CreateCategoryInput,
  ListCategoriesOptions,
  UpdateCategoryInput,
} from '@vp/core/repositories';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { uuidv7 } from 'uuidv7';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

export interface InMemoryCategoryRepositoryOptions {
  videosRepo?: InMemoryVideoRepository;
}

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

  async findAll(options?: ListCategoriesOptions): Promise<Category[]> {
    let result = Array.from(this.categories.values());
    if (options?.activeOnly) {
      result = result.filter((c) => c.isActive);
    }
    return result.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    });
  }

  async findById(id: string): Promise<Category | null> {
    return this.categories.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    for (const cat of this.categories.values()) {
      if (cat.slug === slug) {
        return cat;
      }
    }
    return null;
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const existing = await this.findBySlug(input.slug);
    if (existing) {
      throw new PermanentError(
        ErrorCodes.CATEGORY_SLUG_CONFLICT,
        `Category with slug "${input.slug}" already exists`
      );
    }

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
    return category;
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const existing = this.categories.get(id);
    if (!existing) {
      throw new PermanentError(ErrorCodes.CATEGORY_NOT_FOUND, `Category "${id}" not found`);
    }

    if (input.slug && input.slug !== existing.slug) {
      const slugOwner = await this.findBySlug(input.slug);
      if (slugOwner && slugOwner.id !== id) {
        throw new PermanentError(
          ErrorCodes.CATEGORY_SLUG_CONFLICT,
          `Category with slug "${input.slug}" already exists`
        );
      }
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
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = this.categories.get(id);
    if (!existing) {
      throw new PermanentError(ErrorCodes.CATEGORY_NOT_FOUND, `Category "${id}" not found`);
    }

    const count = await this.countVideos(id);
    if (count > 0) {
      throw new PermanentError(
        ErrorCodes.CATEGORY_IN_USE,
        `Cannot delete category "${id}" because it is referenced by ${count} video(s)`
      );
    }

    this.categories.delete(id);
  }

  async countVideos(categoryId: string): Promise<number> {
    if (this.videosRepo) {
      return this.videosRepo.countByCategoryId(categoryId);
    }
    return 0;
  }
}
