import { type ApiStore, createApiStore, seed } from '#app/__tests__/api-store';
import { renderPage } from '#app/__tests__/render-page';
import { categoriesApi } from '#app/modules/shared/api/categories-api';
import { CategoryList } from '../category-list';

const MUSIC_ID = '0190c3a0-5e1d-7000-8000-00000000d001';

const music = {
  id: MUSIC_ID,
  slug: 'music',
  name: 'Music',
  description: null,
  iconUrl: null,
  sortOrder: 1,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function storeWithCategories(): Promise<ApiStore> {
  const store = createApiStore();
  await seed(store, (target) => target.dispatch(categoriesApi.endpoints.categories.initiate()), [
    music,
  ]);
  return store;
}

async function renderCategories(
  store: ApiStore,
  selectedCategoryId: string | undefined
): Promise<string> {
  return renderPage(
    <CategoryList onCategoryChange={() => {}} selectedCategoryId={selectedCategoryId} />,
    { store }
  );
}

describe('apps/web: category list', () => {
  it('offers All, selected, before the categories arrive', async () => {
    expect(await renderCategories(createApiStore(), undefined)).toContain(
      'class="btn btn-dark">All<'
    );
  });

  it.each([
    { selectedCategoryId: undefined, selected: 'All', other: 'Music' },
    { selectedCategoryId: MUSIC_ID, selected: 'Music', other: 'All' },
  ])(
    'highlights $selected among the categories the API listed',
    async ({ selectedCategoryId, selected, other }) => {
      const markup = await renderCategories(await storeWithCategories(), selectedCategoryId);

      expect(markup).toContain(`class="btn btn-dark">${selected}<`);
      expect(markup).toContain(`class="btn btn-light">${other}<`);
    }
  );
});
