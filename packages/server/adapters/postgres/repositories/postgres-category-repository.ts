import type {
  Category,
  CreateCategoryInput,
  ListCategoriesOptions,
  UpdateCategoryInput,
} from '@vp/domain';
import { DatabaseError } from '@vp/core/ports';
import type { CategoryRepositoryPort } from '@vp/core/repositories';
import { categories, videos } from '@vp/db';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { uuidv7 } from 'uuidv7';

export class PostgresCategoryRepository implements CategoryRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase<Record<string, unknown>>) {}

  private mapRow(row: typeof categories.$inferSelect): Category {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      iconUrl: row.iconUrl,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findAll(options?: ListCategoriesOptions): Promise<Category[]> {
    try {
      let query = this.db.select().from(categories).$dynamic();
      if (options?.activeOnly) {
        query = query.where(eq(categories.isActive, true));
      }
      const rows = await query.orderBy(asc(categories.sortOrder), asc(categories.name));
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      throw new DatabaseError(`Failed to find categories: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async findById(id: string): Promise<Category | null> {
    try {
      const [row] = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);
      return row ? this.mapRow(row) : null;
    } catch (err) {
      throw new DatabaseError(`Failed to find category by ID: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async findBySlug(slug: string): Promise<Category | null> {
    try {
      const [row] = await this.db
        .select()
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);
      return row ? this.mapRow(row) : null;
    } catch (err) {
      throw new DatabaseError(`Failed to find category by slug: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    try {
      const [row] = await this.db
        .insert(categories)
        .values({
          id: input.id ?? uuidv7(),
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          iconUrl: input.iconUrl ?? null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
        })
        .returning();

      if (!row) {
        throw new DatabaseError('Failed to insert category: no row returned');
      }
      return this.mapRow(row);
    } catch (err: unknown) {
      const pgErr = err as { code?: string; message?: string };
      if (pgErr.code === '23505') {
        throw new PermanentError(
          ErrorCodes.CATEGORY_SLUG_CONFLICT,
          `Category with slug "${input.slug}" already exists`
        );
      }
      if (err instanceof PermanentError) throw err;
      throw new DatabaseError(`Failed to create category: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    try {
      if (input.slug) {
        const [conflict] = await this.db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.slug, input.slug), ne(categories.id, id)))
          .limit(1);
        if (conflict) {
          throw new PermanentError(
            ErrorCodes.CATEGORY_SLUG_CONFLICT,
            `Category with slug "${input.slug}" already exists`
          );
        }
      }

      const updateValues: Partial<typeof categories.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.slug !== undefined) updateValues.slug = input.slug;
      if (input.name !== undefined) updateValues.name = input.name;
      if (input.description !== undefined) updateValues.description = input.description;
      if (input.iconUrl !== undefined) updateValues.iconUrl = input.iconUrl;
      if (input.sortOrder !== undefined) updateValues.sortOrder = input.sortOrder;
      if (input.isActive !== undefined) updateValues.isActive = input.isActive;

      const [row] = await this.db
        .update(categories)
        .set(updateValues)
        .where(eq(categories.id, id))
        .returning();

      if (!row) {
        throw new PermanentError(ErrorCodes.CATEGORY_NOT_FOUND, `Category "${id}" not found`);
      }
      return this.mapRow(row);
    } catch (err: unknown) {
      const pgErr = err as { code?: string; message?: string };
      if (pgErr.code === '23505') {
        throw new PermanentError(
          ErrorCodes.CATEGORY_SLUG_CONFLICT,
          `Category with slug "${input.slug}" already exists`
        );
      }
      if (err instanceof PermanentError) throw err;
      throw new DatabaseError(`Failed to update category: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.findById(id);
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

      await this.db.delete(categories).where(eq(categories.id, id));
    } catch (err) {
      if (err instanceof PermanentError) throw err;
      throw new DatabaseError(`Failed to delete category: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async countVideos(categoryId: string): Promise<number> {
    try {
      const [res] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(videos)
        .where(and(eq(videos.categoryId, categoryId), sql`${videos.deletedAt} IS NULL`));
      return res?.count ?? 0;
    } catch (err) {
      throw new DatabaseError(`Failed to count videos for category: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }
}
