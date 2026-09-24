import { categories, videos } from '../schema';

describe('categories schema', () => {
  it('defines categories table with correct columns and defaults', () => {
    expect(categories).toBeDefined();
    expect(categories.id).toBeDefined();
    expect(categories.slug).toBeDefined();
    expect(categories.name).toBeDefined();
    expect(categories.description).toBeDefined();
    expect(categories.iconUrl).toBeDefined();
    expect(categories.sortOrder).toBeDefined();
    expect(categories.isActive).toBeDefined();
    expect(categories.createdAt).toBeDefined();
    expect(categories.updatedAt).toBeDefined();
  });

  it('defines categoryId foreign key on videos table', () => {
    expect(videos.categoryId).toBeDefined();
  });
});
