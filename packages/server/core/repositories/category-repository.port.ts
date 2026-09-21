import type {
  Category,
  CreateCategoryInput,
  ListCategoriesOptions,
  UpdateCategoryInput,
} from '../domain/category';

export type { Category, CreateCategoryInput, ListCategoriesOptions, UpdateCategoryInput };

export interface CategoryRepositoryPort {
  findAll(options?: ListCategoriesOptions): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  create(input: CreateCategoryInput): Promise<Category>;
  update(id: string, input: UpdateCategoryInput): Promise<Category>;
  delete(id: string): Promise<void>;
  countVideos(categoryId: string): Promise<number>;
}
