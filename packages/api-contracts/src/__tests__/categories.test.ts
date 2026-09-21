import { CategorySchema, listCategories } from '../categories';

const category = {
  id: '00000000-0000-7000-8000-0000000000c1',
  slug: 'gaming',
  name: 'Gaming',
  description: null,
  iconUrl: null,
  sortOrder: 1,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('packages/api-contracts: categories', () => {
  it('is an anonymous GET /v1/categories returning a list', () => {
    expect(listCategories).toMatchObject({
      method: 'GET',
      path: '/v1/categories',
      anonymous: true,
    });
    expect(listCategories.result.parse([category])).toHaveLength(1);
  });

  it('identifies a category by uuid and slug, not by a numeric id', () => {
    expect(CategorySchema.parse(category).slug).toBe('gaming');
    expect(CategorySchema.safeParse({ ...category, id: 3 }).success).toBe(false);
  });
});
