import {
  CreateCategorySchema,
  UpdateCategorySchema,
  createCategory,
  deleteCategory,
  updateCategory,
} from '../admin-categories';

describe('packages/api-contracts: admin categories', () => {
  it.each([
    [createCategory, 'POST', '/v1/admin/categories', 201],
    [updateCategory, 'PATCH', '/v1/admin/categories/:id', 200],
    [deleteCategory, 'DELETE', '/v1/admin/categories/:id', 204],
  ])('declares %#: $method $path', (contract, method, path, status) => {
    expect(contract.method).toBe(method);
    expect(contract.path).toBe(path);
    expect(contract.status).toBe(status);
  });

  it('defaults a new category to active at the front of the order', () => {
    expect(CreateCategorySchema.parse({ name: 'Gaming', slug: 'gaming' })).toMatchObject({
      sortOrder: 0,
      isActive: true,
    });
  });

  it.each(['Gaming', 'gaming games', 'gaming_'])('rejects %s as a slug', (slug) => {
    expect(CreateCategorySchema.safeParse({ name: 'Gaming', slug }).success).toBe(false);
  });

  it('refuses an empty update', () => {
    expect(UpdateCategorySchema.safeParse({}).success).toBe(false);
    expect(UpdateCategorySchema.safeParse({ isActive: false }).success).toBe(true);
  });
});
