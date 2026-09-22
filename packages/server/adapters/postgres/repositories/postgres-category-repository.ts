import type { CategoryRepositoryPort } from '@vp/core/repositories';
import { categories, videos } from '@vp/db';
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
  databaseUnavailable,
} from '@vp/errors';
import { type Result, err, fromPromise, map, ok } from '@vp/result';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { uuidv7 } from 'uuidv7';
import { isUniqueViolation } from '../pg-errors';

function mapRow(row: typeof categories.$inferSelect): Category {
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

export class PostgresCategoryRepository implements CategoryRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase<Record<string, unknown>>) {}

  private unavailable(operation: string) {
    return (cause: unknown): DatabaseUnavailable => databaseUnavailable(operation, cause);
  }

  /** A unique index on `slug` is the only conflict this table can report. */
  private conflict(slug: string, operation: string) {
    return (cause: unknown): DatabaseUnavailable | CategorySlugConflict =>
      isUniqueViolation(cause) ? categorySlugConflict(slug) : databaseUnavailable(operation, cause);
  }

  async findAll(
    options?: ListCategoriesOptions
  ): Promise<Result<Category[], DatabaseUnavailable>> {
    let query = this.db.select().from(categories).$dynamic();
    if (options?.activeOnly) {
      query = query.where(eq(categories.isActive, true));
    }

    const rows = await fromPromise(
      query.orderBy(asc(categories.sortOrder), asc(categories.name)),
      this.unavailable('findAll')
    );

    return map(rows, (found) => found.map(mapRow));
  }

  async findById(id: string): Promise<Result<Category | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      this.db.select().from(categories).where(eq(categories.id, id)).limit(1),
      this.unavailable('findById')
    );

    return map(rows, ([row]) => (row ? mapRow(row) : null));
  }

  async findBySlug(slug: string): Promise<Result<Category | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      this.db.select().from(categories).where(eq(categories.slug, slug)).limit(1),
      this.unavailable('findBySlug')
    );

    return map(rows, ([row]) => (row ? mapRow(row) : null));
  }

  async create(
    input: CreateCategoryInput
  ): Promise<Result<Category, DatabaseUnavailable | CategorySlugConflict>> {
    const rows = await fromPromise(
      this.db
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
        .returning(),
      this.conflict(input.slug, 'create')
    );

    if (!rows.ok) return rows;
    const [row] = rows.value;
    return row
      ? ok(mapRow(row))
      : err(databaseUnavailable('create', 'insert returned no row'));
  }

  async update(
    id: string,
    input: UpdateCategoryInput
  ): Promise<Result<Category | null, DatabaseUnavailable | CategorySlugConflict>> {
    if (input.slug) {
      const conflicting = await fromPromise(
        this.db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.slug, input.slug), ne(categories.id, id)))
          .limit(1),
        this.unavailable('update')
      );
      if (!conflicting.ok) return conflicting;
      if (conflicting.value[0]) return err(categorySlugConflict(input.slug));
    }

    const values: Partial<typeof categories.$inferInsert> = { updatedAt: new Date() };
    if (input.slug !== undefined) values.slug = input.slug;
    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined) values.description = input.description;
    if (input.iconUrl !== undefined) values.iconUrl = input.iconUrl;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) values.isActive = input.isActive;

    const rows = await fromPromise(
      this.db.update(categories).set(values).where(eq(categories.id, id)).returning(),
      this.conflict(input.slug ?? '', 'update')
    );

    return map(rows, ([row]) => (row ? mapRow(row) : null));
  }

  async delete(id: string): Promise<Result<void, DatabaseUnavailable>> {
    const deleted = await fromPromise(
      this.db.delete(categories).where(eq(categories.id, id)),
      this.unavailable('delete')
    );

    return map(deleted, () => undefined);
  }

  async countVideos(categoryId: string): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(videos)
        .where(and(eq(videos.categoryId, categoryId), sql`${videos.deletedAt} IS NULL`)),
      this.unavailable('countVideos')
    );

    return map(rows, ([row]) => row?.count ?? 0);
  }
}
